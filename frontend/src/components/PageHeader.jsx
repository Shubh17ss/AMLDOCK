import { Box, Typography } from '@mui/material';
import { tokens, fonts } from '../theme/theme.js';

/**
 * Standard page header in the "Clearance" language: a monospace ledger eyebrow (encode a real
 * fact — a count, a scope), the FK Grotesk display title, optional subtitle, and right-aligned
 * actions. Mirrors the dashboard header so every screen reads as one product.
 */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography sx={{
            fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.16em',
            color: tokens.muted, textTransform: 'uppercase', mb: 0.75,
          }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: tokens.ink }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>{subtitle}</Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>{actions}</Box>}
    </Box>
  );
}
