import { Chip } from '@mui/material';
import { tokens, fonts } from '../theme/theme.js';

/**
 * A deal's AML risk position, derived server-side from the broker's answers.
 *
 * Null is the honest state for deals created before risk was captured — they were never
 * assessed, and showing them as LOW would be an assertion nobody made. `hideWhenUnset` keeps
 * dense rows from filling up with "Not assessed" where the absence carries no information.
 */
const STYLE_BY_RATING = {
  LOW:    { label: 'Low risk',    fg: tokens.approved, bg: 'var(--cl-ok-wash)' },
  MEDIUM: { label: 'Medium risk', fg: tokens.review,   bg: 'var(--cl-warn-wash)' },
  HIGH:   { label: 'High risk',   fg: tokens.rejected, bg: 'var(--cl-err-wash)' },
};

export function RiskRatingChip({ rating, hideWhenUnset = false, size = 'small' }) {
  const style = STYLE_BY_RATING[rating];

  if (!style) {
    if (hideWhenUnset) return null;
    return (
      <Chip
        size={size}
        label="Not assessed"
        sx={{
          fontFamily: fonts.mono, fontSize: '0.66rem', letterSpacing: '0.04em',
          color: tokens.muted, backgroundColor: tokens.hover,
        }}
      />
    );
  }

  return (
    <Chip
      size={size}
      label={style.label}
      sx={{
        fontFamily: fonts.mono, fontSize: '0.66rem', letterSpacing: '0.04em', fontWeight: 600,
        color: style.fg, backgroundColor: style.bg,
      }}
    />
  );
}
