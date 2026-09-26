import { Box, FormLabel, Stack, TextField, Typography } from '@mui/material';
import { tokens } from '../../../theme/theme.js';

/**
 * How long the client has owned the property, as years and months.
 *
 * <p>Two boxes rather than one total, because that is how the question gets answered out loud —
 * "about eighteen months", "coming up four years". A single month count would be arithmetic the
 * broker has to do on the phone, and the two columns behind this store exactly what was typed.
 *
 * <p>Months is the remainder, not a second way of saying the same thing: 18 months is 1 and 6.
 * Clamped to 0-11 here and by a CHECK constraint, so the two boxes cannot describe two different
 * durations.
 *
 * <p>Either box alone is an answer. Someone who has held it four years leaves months blank, and
 * treating that as unfinished would hold up a save over nothing.
 *
 * <p>Values are digit strings, empty for unanswered — the same convention every other field in
 * this form uses, so that "" can travel and mean "cleared".
 */
export function TenureField({ years, months, onYearsChange, onMonthsChange, required = false }) {
  // Keeps the field to digits without fighting the user: a paste of "1.5" loses the point rather
  // than silently becoming something else, and an empty box stays empty.
  const digits = (v) => v.replace(/[^\d]/g, '');
  const monthsOutOfRange = months !== '' && Number(months) > 11;

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
        How long your client has owned this property. A short hold raises the risk rating.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <TextField
          label="Years"
          value={years}
          onChange={(e) => onYearsChange(digits(e.target.value))}
          inputProps={{ inputMode: 'numeric', maxLength: 3 }}
          sx={{ maxWidth: 140 }}
        />
        <TextField
          label="Months"
          value={months}
          onChange={(e) => onMonthsChange(digits(e.target.value))}
          inputProps={{ inputMode: 'numeric', maxLength: 2 }}
          error={monthsOutOfRange}
          helperText={monthsOutOfRange ? '0–11 — whole years go in the Years box' : undefined}
          sx={{ maxWidth: 140 }}
        />
      </Stack>
    </Box>
  );
}
