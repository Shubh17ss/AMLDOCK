import { tokens } from '../../../theme/theme.js';

/**
 * The three risk bands and the colours each one carries.
 *
 * <p>Extracted from RiskPanel so the override dialog can draw a band the same way the Client
 * risk card does. It lives in its own module rather than being exported from RiskPanel because
 * RiskPanel imports the dialog, and the dialog importing back would be a cycle.
 *
 * <p>Ordered worst first, which is the order the band buttons read in.
 *
 * <p>Four colours per band, and the distinction between two of them is the one worth knowing:
 * `fg` is tuned to be read against the page, `text` is the darker end meant to be read against
 * that band's own `bg`. Anything sitting on a wash wants `text`; a chip floating on the tile
 * wants `fg`.
 *
 * <p>`components/RiskRatingChip.jsx` still keeps its own copy of the first two. It speaks a
 * different label vocabulary ("Low risk" rather than "Low") and is used across the deal lists
 * and headers, so folding it in is a wider change than the surfaces here needed.
 */
export const BANDS = [
  { value: 'HIGH', label: 'High', fg: tokens.rejected, bg: 'var(--cl-err-wash)',
    border: 'var(--cl-err-border)', text: 'var(--cl-err-text)' },
  { value: 'MEDIUM', label: 'Medium', fg: tokens.review, bg: 'var(--cl-warn-wash)',
    border: 'var(--cl-warn-border)', text: 'var(--cl-warn-text)' },
  { value: 'LOW', label: 'Low', fg: tokens.approved, bg: 'var(--cl-ok-wash)',
    border: 'var(--cl-ok-border)', text: 'var(--cl-ok-text)' },
];

/**
 * The palette for a rating, falling back to the middle band for one that is null or
 * unrecognised — a surface losing its colour is better than one throwing.
 *
 * <p>Callers that need to *show* "not assessed" should test the rating themselves rather than
 * relying on this: it always answers with a colour, which is the right default for a container
 * and the wrong one for a label.
 */
export const bandOf = (rating) => BANDS.find((b) => b.value === rating) ?? BANDS[1];
