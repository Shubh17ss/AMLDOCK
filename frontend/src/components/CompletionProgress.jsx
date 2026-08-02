import { Box, LinearProgress, Typography } from '@mui/material';
import { tokens, fonts } from '../theme/theme.js';

/**
 * "3 / 8" plus a bar — how many assigned staff have finished. Shared by the training sessions
 * and courses tables so the two read identically.
 *
 * The totals are always the true ones, even for a viewer who can only see their own roster row.
 */
export function CompletionProgress({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;
  return (
    <Box sx={{ minWidth: 92 }}>
      <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.75rem', color: tokens.ink, mb: 0.4 }}>
        {done} / {total}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 5, borderRadius: 999, backgroundColor: tokens.hairline,
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            backgroundColor: complete ? tokens.approved : tokens.blue,
          },
        }}
      />
    </Box>
  );
}
