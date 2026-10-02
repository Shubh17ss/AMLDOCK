import { Box, FormLabel, Stack, TextField, Typography } from '@mui/material';
import { OptionPill } from '../../../components/OptionPill.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * How long the client has owned the property, as years and months — or "To be confirmed".
 *
 * <p>Two boxes rather than one total, because that is how the question gets answered out loud —
 * "about eighteen months", "coming up four years". A single month count would be arithmetic the
 * broker has to do on the phone, and the two columns behind this store exactly what was typed.
 *
 * <p>Months is the remainder, not a second way of saying the same thing: 18 months is 1 and 6.
 * Clamped to 0-11 here and by a CHECK constraint, so the two boxes cannot describe two different
 * durations. Years is capped at 200 for the duller reason that the server caps it there.
 *
 * <p>Either box alone is an answer. Someone who has held it four years leaves months blank, and
 * treating that as unfinished would hold up a save over nothing.
 *
 * <p>"To be confirmed" is the third answer: asked, and not known yet. It and a figure exclude each
 * other — picking it clears the boxes, typing a figure unpicks it — so the field owns that rule
 * rather than every form that uses it. It scores +3 on the risk rating.
 *
 * <p>Values are digit strings, empty for unanswered — the same convention every other field in
 * this form uses, so that "" can travel and mean "cleared".
 */
export function TenureField({
  years, months, tbc = false, onYearsChange, onMonthsChange, onTbcChange, required = false,
}) {
  // Keeps the field to digits without fighting the user: a paste of "1.5" loses the point rather
  // than silently becoming something else, and an empty box stays empty.
  const digits = (v) => v.replace(/[^\d]/g, '');
  const monthsOutOfRange = !tbc && months !== '' && Number(months) > 11;
  // 200 is the server's cap (@Max(200) on the request). Shown here for the same reason months
  // is: the field that is wrong should be the field that says so, rather than the save button.
  const yearsOutOfRange = !tbc && years !== '' && Number(years) > 200;

  const typeYears = (e) => {
    const v = digits(e.target.value);
    onYearsChange(v);
    if (tbc && v !== '') onTbcChange?.(false);
  };
  const typeMonths = (e) => {
    const v = digits(e.target.value);
    onMonthsChange(v);
    if (tbc && v !== '') onTbcChange?.(false);
  };
  const toggleTbc = () => {
    const next = !tbc;
    onTbcChange?.(next);
    if (next) { onYearsChange(''); onMonthsChange(''); }
  };

  return (
    <Box>
      <FormLabel
        sx={{
          fontSize: '0.9rem', fontWeight: 600, color: tokens.ink,
          '&.Mui-focused': { color: tokens.ink },
        }}
      >
        Current ownership tenure
        {required && <Box component="span" sx={{ color: tokens.rejected, ml: 0.5 }}>*</Box>}
      </FormLabel>
      <Typography variant="caption" sx={{ display: 'block', color: tokens.muted, mt: 0.25 }}>
        How long your client has owned this property. A short hold raises the risk rating, and so
        does leaving it to be confirmed.
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        alignItems="flex-start"
        sx={{ mt: 1 }}
      >
        <TextField
          label="Years"
          value={tbc ? '' : years}
          onChange={typeYears}
          inputProps={{ inputMode: 'numeric', maxLength: 3 }}
          error={yearsOutOfRange}
          helperText={yearsOutOfRange ? '200 years at most' : undefined}
          sx={{ maxWidth: 140, opacity: tbc ? 0.55 : 1 }}
        />
        <TextField
          label="Months"
          value={tbc ? '' : months}
          onChange={typeMonths}
          inputProps={{ inputMode: 'numeric', maxLength: 2 }}
          error={monthsOutOfRange}
          helperText={monthsOutOfRange ? '0–11 — whole years go in the Years box' : undefined}
          sx={{ maxWidth: 140, opacity: tbc ? 0.55 : 1 }}
        />

        {/* Centred on the 56px input row, so it reads as a third answer beside the boxes rather
            than as something underneath them. */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ height: 56 }}>
          <Typography
            component="span"
            sx={{ fontSize: '0.78rem', color: tokens.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            or
          </Typography>
          <OptionPill
            label="To be confirmed"
            fg={tokens.blue}
            bg={tokens.blueWash}
            selected={tbc}
            onSelect={toggleTbc}
            ariaLabel="Ownership tenure to be confirmed"
            sx={{ py: 1 }}
          />
        </Stack>
      </Stack>
    </Box>
  );
}
