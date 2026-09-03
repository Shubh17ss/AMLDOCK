import { TextField } from '@mui/material';

/** How many digits a one-time code has. Mirrors OtpService's `%06d`. */
export const OTP_LENGTH = 6;

/** Whether a code is complete enough to be worth submitting. */
export const isCompleteOtp = (code) => (code ?? '').length === OTP_LENGTH;

/**
 * The six-digit one-time code input.
 *
 * <p>Three details here are load-bearing and were previously copied by hand into each place that
 * asked for a code:
 *
 * <ul>
 *   <li>`autoComplete="one-time-code"` — what lets iOS and Android offer the code straight from the
 *       notification, which is most of the difference between this being pleasant and tedious.</li>
 *   <li>`inputMode="numeric"` — a numeric keypad on mobile rather than a full keyboard.</li>
 *   <li>Non-digits stripped and the value clipped on the way in, so a pasted code carrying a stray
 *       space or a trailing newline still lands as six clean digits.</li>
 * </ul>
 *
 * <p>Extracted because it now appears in three flows — signing in, the administrator's second
 * factor, and confirming a new email address — and a copy that quietly lost `one-time-code` would
 * look identical while being markedly worse to use.
 */
export function OtpCodeField({ value, onChange, label = 'One-time code', ...rest }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
      required
      fullWidth
      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'one-time-code' }}
      {...rest}
    />
  );
}
