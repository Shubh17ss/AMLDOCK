import { InputAdornment, TextField } from '@mui/material';

/**
 * One end of the property-value range.
 *
 * The stored value is digits only. Thousands separators are added for display on every keystroke
 * and stripped again on the way back in, so the form state stays something `Number()` can read —
 * a stored "1,250,000" would reach the API as NaN, and the min/max comparison would quietly stop
 * working.
 *
 * `type="text"` rather than `type="number"`: a number input rejects the commas outright, and
 * brings a spinner and scroll-to-change behaviour nobody wants on a seven-figure field.
 * `inputMode="numeric"` still raises the numeric keypad on a phone, which is where this form is
 * mostly filled in.
 */

/** 1250000 → "1,250,000". Digits in, grouped digits out. */
const withCommas = (digits) => String(digits ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const digitsOnly = (text) => text.replace(/\D/g, '');

export function ValuationField({ label, value, onChange, currencyLabel, helperText }) {
  // onChange is a plain setter from the draft form, so hand back an event-shaped object carrying
  // the cleaned value — the same contract every other field in the wizard uses.
  const handleChange = (e) => onChange({ target: { value: digitsOnly(e.target.value) } });

  return (
    <TextField
      label={label}
      type="text"
      inputMode="numeric"
      value={withCommas(value)}
      onChange={handleChange}
      fullWidth
      helperText={helperText}
      InputProps={{
        startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment>,
      }}
    />
  );
}
