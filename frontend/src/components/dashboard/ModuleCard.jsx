import { Box, Tooltip, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded';
import { tokens, fonts, shadows } from '../../theme/theme.js';
import { BentoTile, Eyebrow } from '../bento/BentoTile.jsx';
import { reviewMetaFor } from '../documents/reviewStatus.jsx';

/**
 * A compliance-module card for the dashboard hub. Mirrors the reference layout:
 * title + status icon, an ISSUES / WARNINGS numeral pair, and a review-date footer.
 * Built on BentoTile so the staggered load, hover-lift, and focus ring come for free.
 *
 * Placeholder-friendly: every metric defaults to a neutral, all-clear state until the
 * module is wired to real data. When `reviewStatus` is supplied (UNSET / OVERDUE /
 * ON_TRACK) the status icon becomes the three-state review indicator and the footer
 * shows the review due date.
 */
export function ModuleCard({
  label,
  to,
  index = 0,
  issues = 0,
  warnings = 0,
  status = 'ok',           // 'ok' → green check, 'attention' → red alert
  reviewStatus = null,     // when set, drives a green/orange/red review indicator
  reviewDate = '—',
  onReview = null,         // when set, a Review action appears in the footer
}) {
  const attention = status === 'attention';
  const reviewMeta = reviewStatus ? reviewMetaFor(reviewStatus) : null;
  const StatusIcon = reviewMeta ? reviewMeta.Icon : (attention ? ErrorRoundedIcon : CheckCircleRoundedIcon);
  const statusColor = reviewMeta ? reviewMeta.color : (attention ? tokens.rejected : tokens.approved);

  return (
    <BentoTile
      index={index}
      to={to}
      ariaLabel={label}
      sx={{
        p: { xs: 2.5, md: 3 },
        // Fixed, not a minimum. A minimum let a card with a two-line title grow, and since every
        // card in a row stretches to the tallest, one long label made a whole section taller than
        // the one above it. The title below reserves its two lines whether it needs them or not,
        // so this height fits the longest label in the registry with nothing to spare.
        height: { xs: 180, md: 210 },
        // Status chip pops with the card lift. Motion-safe wrapper (rather than a
        // reduce guard) so this key can't collide with BentoTile's own media block.
        '@media (prefers-reduced-motion: no-preference)': {
          '&:hover .card-status-chip': { transform: 'scale(1.1)' },
        },
      }}
    >
      {/* Title + status */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{
          fontWeight: 700, fontSize: '0.98rem', color: tokens.ink, lineHeight: 1.25, minWidth: 0,
          // Two lines, always: reserved when the label is short so the metrics below start at the
          // same y on every card, and clamped when it is long so a third line cannot push the
          // card taller than its neighbours. 2.5em is the two lines at this line-height.
          minHeight: '2.5em',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }}>
          {label}
        </Typography>
        {/* Tinted wash chip lifts the status icon off the glass for contrast. */}
        <Box
          className="card-status-chip"
          sx={{
            width: 30, height: 30, borderRadius: '10px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: `color-mix(in srgb, ${statusColor} 11%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${statusColor} 15%, transparent)`,
            transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <StatusIcon sx={{ fontSize: 18, color: statusColor }} />
        </Box>
      </Box>

      {/* ISSUES / WARNINGS */}
      <Box sx={{ mt: 'auto', display: 'flex', gap: 3 }}>
        <Metric value={issues} label="Issues" color={issues > 0 ? tokens.rejected : tokens.ink} />
        <Metric value={warnings} label="Warnings" color={warnings > 0 ? tokens.review : tokens.ink} />
      </Box>

      {/* Review date footer */}
      <Box sx={{ mt: 1.75, pt: 1.25, borderTop: `1px solid ${tokens.hairline}`,
                 display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Eyebrow>Review Date</Eyebrow>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography sx={{
            fontFamily: fonts.mono, fontSize: '0.74rem', whiteSpace: 'nowrap',
            color: reviewMeta ? statusColor : tokens.muted,
            fontWeight: reviewMeta ? 700 : 400,
          }}>
            {reviewDate}
          </Typography>
          {onReview && (
            <Tooltip title={`Set ${label} review date`}>
              {/* The whole card is a link, so this must swallow the click rather than
                  navigate. Rendered as a span (not a button) to avoid nesting a button
                  inside an anchor, with explicit keyboard handling to stay operable. */}
              <Box
                component="span"
                role="button"
                tabIndex={0}
                aria-label={`Set ${label} review date`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReview(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); e.stopPropagation(); onReview();
                  }
                }}
                sx={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '7px', flexShrink: 0, cursor: 'pointer',
                  color: tokens.muted, backgroundColor: 'transparent',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  '&:hover': { backgroundColor: tokens.blueWash, color: tokens.blue },
                  '&:focus-visible': { outline: 'none', boxShadow: shadows.focus },
                }}
              >
                <EditCalendarRoundedIcon sx={{ fontSize: 15 }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>
    </BentoTile>
  );
}

function Metric({ value, label, color }) {
  return (
    <Box>
      <Typography sx={{
        fontFamily: fonts.display, fontWeight: 800, lineHeight: 1,
        fontSize: 'clamp(1.6rem, 3vw, 2rem)', letterSpacing: '-0.03em', color,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </Typography>
      <Box sx={{ mt: 0.6 }}><Eyebrow>{label}</Eyebrow></Box>
    </Box>
  );
}
