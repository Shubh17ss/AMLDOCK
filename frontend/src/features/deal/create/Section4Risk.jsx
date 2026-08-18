import { Alert, Stack, TextField, Typography } from '@mui/material';
import { VoiceRecorderField } from '../../../components/VoiceRecorderField.jsx';
import { useCurrency } from '../../../dashboard/useCurrency.js';
import { SectionCard, FieldGroup } from './SectionShell.jsx';
import { ValuationField } from './ValuationField.jsx';
import { YesNoField } from './YesNoField.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * Section 4 — the broker's own read on the deal: any red flag, what the property is worth,
 * and whatever else compliance should know.
 *
 * Value is captured as a range with evidence behind each end rather than a single figure,
 * because at listing time that is genuinely what the broker knows.
 */
export function Section4Risk({
  form, setField, dealId, minEvidence, maxEvidence, onUploaded, onRemoved,
  voiceBlob, onVoiceChange,
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
      </FieldGroup>

      <FieldGroup title="Property value">
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          The range you'd expect this property to sell within. Attach what backs each figure —
          a CMA, an appraisal, or an RV screenshot.
        </Typography>

        {!dealId && (
          <Alert severity="info">Saving your draft so evidence images have somewhere to go…</Alert>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <ValuationField
            label="Minimum value"
            value={form.valuationMin}
            onChange={setField('valuationMin')}
            documentType="VALUATION_MIN_EVIDENCE"
            dealId={dealId}
            evidence={minEvidence}
            onUploaded={onUploaded}
            onRemoved={onRemoved}
            currencyLabel={money.label}
          />
          <ValuationField
            label="Maximum value"
            value={form.valuationMax}
            onChange={setField('valuationMax')}
            documentType="VALUATION_MAX_EVIDENCE"
            dealId={dealId}
            evidence={maxEvidence}
            onUploaded={onUploaded}
            onRemoved={onRemoved}
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
          label="Notes for compliance"
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
