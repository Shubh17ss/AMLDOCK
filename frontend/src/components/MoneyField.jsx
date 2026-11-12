import { InputAdornment, TextField } from '@mui/material';

/**
 * An amount of money, typed.
 *
 * Used for both ends of the property-value range and for what a deal finally sold for.
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

/**
 * Digits with at most one point and two places after it: "1,234.567" → "1234.56". A trailing
 * point survives, so "12." can be typed on the way to "12.5".
 */
const decimalOnly = (text) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot) + '.' + cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
};

/** Groups the whole part only: "1234567.5" → "1,234,567.5". */
const withCommasDecimal = (value) => {
  const text = String(value ?? '');
  const dot = text.indexOf('.');
  return dot === -1 ? withCommas(text) : withCommas(text.slice(0, dot)) + text.slice(dot);
};

export function MoneyField({ label, value, onChange, currencyLabel, helperText,
                            required = false, disabled = false, autoFocus = false,
                            /** Accept cents. Off by default: property values are whole dollars. */
                            allowDecimals = false }) {
  // onChange is a plain setter from the draft form, so hand back an event-shaped object carrying
  // the cleaned value — the same contract every other field in the wizard uses.
  const clean = allowDecimals ? decimalOnly : digitsOnly;
  const handleChange = (e) => onChange({ target: { value: clean(e.target.value) } });

  return (
    <TextField
      label={label}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={allowDecimals ? withCommasDecimal(value) : withCommas(value)}
      onChange={handleChange}
      fullWidth
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      helperText={helperText}
      InputProps={{
        startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment>,
      }}
    />
  );
}
