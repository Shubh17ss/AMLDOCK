import { Box, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import { tokens, fonts } from '../../theme/theme.js';
import { BentoTile, Eyebrow } from '../bento/BentoTile.jsx';

/**
 * A compliance-module card for the dashboard hub. Mirrors the reference layout:
 * title + status icon, an ISSUES / WARNINGS numeral pair, and a review-date footer.
 * Built on BentoTile so the staggered load, hover-lift, and focus ring come for free.
 *
 * Placeholder-friendly: every metric defaults to a neutral, all-clear state until the
 * module is wired to real data.
 */
export function ModuleCard({
  label,
  to,
  index = 0,
  issues = 0,
  warnings = 0,
  status = 'ok',           // 'ok' → green check, 'attention' → red alert
  reviewDate = '—',
}) {
  const attention = status === 'attention';
  const StatusIcon = attention ? ErrorRoundedIcon : CheckCircleRoundedIcon;

  return (
    <BentoTile index={index} to={to} ariaLabel={label} sx={{ p: 2.25 }}>
      {/* Title + status */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.98rem', color: tokens.ink, lineHeight: 1.25, minWidth: 0 }}>
          {label}
        </Typography>
        <StatusIcon sx={{ fontSize: 20, flexShrink: 0, color: attention ? tokens.rejected : tokens.approved }} />
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
        <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.74rem', color: tokens.muted, whiteSpace: 'nowrap' }}>
          {reviewDate}
        </Typography>
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
      }}>
        {value}
      </Typography>
      <Box sx={{ mt: 0.6 }}><Eyebrow>{label}</Eyebrow></Box>
    </Box>
  );
}
