import { Alert, Collapse, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { VoiceRecorderField } from '../../../components/VoiceRecorderField.jsx';
import { useCurrency } from '../../../dashboard/useCurrency.js';
import { RED_FLAGS } from '../../../data/redFlags.js';
import { SectionCard, FieldGroup } from './SectionShell.jsx';
import { ValuationField } from './ValuationField.jsx';
import { YesNoField } from './YesNoField.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * Section 5 — the broker's own read on the deal: any red flag, what the property is worth,
 * and whatever else compliance should know.
 *
 * Value is captured as a range rather than a single figure, because at listing time that is
 * genuinely what the broker knows.
 */
export function Section5Risk({
  form, setField, voiceBlob, onVoiceChange,
}) {
  const money = useCurrency();
  const min = form.valuationMin === '' ? null : Number(form.valuationMin);
  const max = form.valuationMax === '' ? null : Number(form.valuationMax);
  const rangeInverted = min != null && max != null && max < min;

  return (
    <SectionCard
      title="Risk & valuation"
      subtitle="Your assessment of the deal, and what the property is worth."
    >
      <FieldGroup title="Red flag">
        <YesNoField
          label="Is there a red flag on this deal?"
          help="Anything that struck you as off — evasiveness, urgency without reason, a third party steering the sale."
          value={form.redFlagPresent}
          onChange={setField('redFlagPresent')}
          required
          warnOnYes="Compliance will look at this deal more closely."
        />

        {/* The same list the suspicious-activity register uses (data/redFlags.js), so a flag
            raised here and a suspicion reported later are the same vocabulary. Collapse rather
            than a bare conditional: the field arriving is the consequence of answering Yes, and
            it should look like one. */}
        <Collapse in={form.redFlagPresent === true} unmountOnExit>
          <FormControl fullWidth required sx={{ mt: 1 }}>
            <InputLabel id="deal-red-flag-label">Which red flag</InputLabel>
            <Select
              labelId="deal-red-flag-label"
              label="Which red flag"
              value={form.redFlag}
              onChange={setField('redFlag')}
            >
              {RED_FLAGS.map((f) => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Collapse>
      </FieldGroup>

      <FieldGroup title="Property value">
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          The range you'd expect this property to sell within.
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <ValuationField
            label="Minimum value"
            value={form.valuationMin}
            onChange={setField('valuationMin')}
            currencyLabel={money.label}
          />
          <ValuationField
            label="Maximum value"
            value={form.valuationMax}
            onChange={setField('valuationMax')}
            currencyLabel={money.label}
            helperText={rangeInverted ? 'Must be at or above the minimum' : undefined}
          />
        </Stack>

        {rangeInverted && (
          <Alert severity="error">
            The maximum value is below the minimum. Swap them, or correct whichever is wrong.
          </Alert>
        )}
      </FieldGroup>

      <FieldGroup title="Deal notes">
        <TextField
          label="Add relevant notes"
          value={form.notes}
          onChange={setField('notes')}
          multiline
          minRows={4}
          fullWidth
          placeholder="e.g. Vendor's solicitor will send the trust deed amendment by Friday."
        />
        <VoiceRecorderField
          value={voiceBlob}
          onChange={onVoiceChange}
          label="Or record a note (optional)"
          helper="Tap Record, then 'Save recording' to attach it. It uploads when you submit."
        />
      </FieldGroup>
    </SectionCard>
  );
}
