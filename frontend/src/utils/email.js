/**
 * Front-end email check for the forms that create or edit people and contacts. Practical rather
 * than RFC-complete: one @, no spaces, and a dot in the domain followed by at least two characters
 * — which catches the typos that matter ("jane@agency", "jane.agency.nz", "jane @agency.nz")
 * without turning away real addresses. The server's @Email validation still has the last word.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export const isValidEmail = (value) => EMAIL_RE.test((value ?? '').trim());

/** True only for a value that has been typed and is not an email: empty is a separate question. */
export const isBadEmail = (value) => Boolean((value ?? '').trim()) && !isValidEmail(value);

/**
 * `error` and `helperText` for an email TextField. Silent while the field is empty, so a form does
 * not open covered in red; `hint` is shown when there is nothing wrong.
 */
export const emailFieldProps = (value, hint) => (isBadEmail(value)
  ? { error: true, helperText: 'Enter a valid email address, e.g. name@agency.co.nz' }
  : { helperText: hint });
