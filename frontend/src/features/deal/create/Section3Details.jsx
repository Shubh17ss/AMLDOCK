import { useEffect } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { CountrySelect } from '../../../components/CountrySelect.jsx';
import { VoiceRecorderField } from '../../../components/VoiceRecorderField.jsx';
import { PROPERTY_TYPES, reasonsForPropertyType } from '../../../data/propertyTypes.js';
import { SectionCard, FieldGroup } from './SectionShell.jsx';
import { TenureField } from './TenureField.jsx';
import { YesNoField } from './YesNoField.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * Section 3 — what the property is, and why it's being sold.
 *
 * This is where the AML signal actually lives: the reason for selling, whether a trust sits in
 * the beneficial ownership, how long the client has held the property, whether they were met in
 * person with their original IDs, and any foreign exposure.
 *
 * <p>There is no running risk preview here any more. The rating is a score drawn from the whole
 * ownership structure as well as these answers, and the structure does not exist yet at this
 * point in the form — a preview built from half the inputs would be wrong more often than not.
 * It is shown on the deal page once there is something to show.
 *
 * It sits after the deal exists, so none of it blocks getting the file open — a broker can
 * leave at the address and come back to these answers.
 */
export function Section3Details({ form, setNested, setField, voiceBlob, onVoiceChange }) {
  const propertyType = form.property.propertyType;
  const reasons = reasonsForPropertyType(propertyType);

  // Reasons are keyed off the property type, so a reason that no longer belongs to the chosen
  // type must go. '' rather than null — the API reads an empty string as "clear this" and
  // would ignore null.
  useEffect(() => {
    if (!form.property.reasonForSelling) return;
    if (reasons.some((r) => r.value === form.property.reasonForSelling)) return;
    setNested('property', 'reasonForSelling')('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType]);

  return (
    <SectionCard
      title="Property details"
      subtitle="What it is, and why your client is selling."
    >
      <FieldGroup title="Classification">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth required>
            <InputLabel id="property-type-label">Property type</InputLabel>
            <Select
              labelId="property-type-label"
              label="Property type"
              value={propertyType}
              onChange={setNested('property', 'propertyType')}
            >
              {PROPERTY_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required disabled={!propertyType}>
            <InputLabel id="reason-label">Reason for selling</InputLabel>
            <Select
              labelId="reason-label"
              label="Reason for selling"
              value={form.property.reasonForSelling}
              onChange={setNested('property', 'reasonForSelling')}
            >
              {reasons.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        {!propertyType && (
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            Pick a property type first — the reasons offered depend on it.
          </Typography>
        )}
      </FieldGroup>

      <FieldGroup title="Transaction purpose">
        <TextField
          label="Transaction purpose"
          placeholder="transaction purpose"
          value={form.transactionPurpose}
          onChange={setField('transactionPurpose')}
          multiline
          minRows={3}
          fullWidth
          helperText="In your client's own words, as far as you can tell it."
        />
        <VoiceRecorderField
          value={voiceBlob}
          onChange={onVoiceChange}
          label="Or record it (optional)"
          helper="Tap Record, then 'Save recording' to attach it. It uploads when you move to the next section."
        />
      </FieldGroup>

      <FieldGroup title="Compliance checks">
        <YesNoField
          label="Is there a trust involved in the beneficial ownership?"
          value={form.trustInvolved}
          onChange={setField('trustInvolved')}
          required
        />

        <TenureField
          years={form.ownershipTenureYears}
          months={form.ownershipTenureMonths}
          onYearsChange={setField('ownershipTenureYears')}
          onMonthsChange={setField('ownershipTenureMonths')}
          required
        />

        <YesNoField
          label="Did you meet the client face to face and verify their original IDs?"
          help="Both halves matter — seeing someone is not the same as sighting their documents."
          value={form.faceToFaceIdVerified}
          onChange={setField('faceToFaceIdVerified')}
          required
        />

        <CountrySelect
          label="Foreign exposure"
          value={form.foreignExposureCountry || null}
          onChange={(code) => setField('foreignExposureCountry')(code ?? '')}
          noneOption
          required
          helperText="Any country your client has ties to. Pick “None” if there are none — leaving it blank reads as unanswered."
        />
      </FieldGroup>
    </SectionCard>
  );
}
