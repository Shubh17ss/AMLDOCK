import { tokens } from '../../theme/theme.js';
import { formatDateTime } from '../../utils/formatters.js';

/**
 * The three states an owner can be in, to a reviewer.
 *
 * <p>The server keeps five. NOT_STARTED, IN_PROGRESS and FAILED are all written when a node is
 * created — by hand, by extraction, or as an implied trust — and none of them is a decision
 * anybody took, so they collapse into one: not cleared yet. Printing the raw enum instead, which
 * is what the tree row used to do, told a reviewer the difference between "in progress" and
 * "failed" when there is no difference in what they have to do about it.
 *
 * <p>The two cleared states share a word and a colour, because an owner verified by exception is
 * verified. What separates them is the alert glyph, not a different label or a warning colour —
 * the exception is a note on a decision, not a lesser version of it.
 *
 * <p>One table, read by the tree row, the owner picker and the Verification tab, so the same
 * owner cannot read as cleared in one place and pending in another.
 */
export const VERIFICATION_DISPLAY = {
  VERIFIED: {
    label: 'Verified',
    text: tokens.approved,
    wash: 'var(--cl-ok-wash)',
    border: 'var(--cl-ok-wash)',
    exception: false,
    verified: true,
  },
  VERIFIED_WITH_EXCEPTION: {
    label: 'Verified',
    // Cleared, so green — the amber is carried by the glyph alone.
    text: tokens.approved,
    wash: 'var(--cl-ok-wash)',
    border: 'var(--cl-warn-border)',
    exception: true,
    verified: true,
  },
  NOT_VERIFIED: {
    label: 'Not Verified',
    text: tokens.rejected,
    wash: 'var(--cl-err-wash)',
    border: 'var(--cl-err-wash)',
    exception: false,
    verified: false,
  },
};

/** How a node's stored status should read. Anything uncleared is one state. */
export function verificationDisplay(status) {
  return VERIFICATION_DISPLAY[status] ?? VERIFICATION_DISPLAY.NOT_VERIFIED;
}

/** Whether a stored status means the owner has been cleared, by either route. */
export function isVerified(status) {
  return verificationDisplay(status).verified;
}

/**
 * "26 Sep 2026, 12:04" — the local rendering of a verification stamp.
 *
 * <p>Null for a missing or unparseable value, so a caller can drop the byline rather than print
 * "Invalid Date" beside somebody's name.
 */
export function formatVerifiedAt(iso) {
  return formatDateTime(iso);
}
