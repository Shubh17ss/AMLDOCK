import { Box, Typography } from '@mui/material';
import { ScaleLoader } from 'react-spinners';
import { tokens } from '../theme/theme.js';

/**
 * Full-viewport blocking overlay: blurs everything behind it and centres a spinner with a
 * title + sub-text. Used while a long, navigation-committing action runs (e.g. submitting a
 * deal) so the user gets clear feedback and can't double-submit while it's in flight.
 */
export function LoadingOverlay({ open, title = 'Working…', subText }) {
  if (!open) return null;
  return (
    <Box
      role="alert"
      aria-busy="true"
      aria-live="assertive"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: (t) => t.zIndex.modal + 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
        px: 3,
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <ScaleLoader color={tokens.blue} height={40} width={5} radius={3} margin={3} />
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.ink }}>
          {title}
        </Typography>
        {subText && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5, maxWidth: 380, mx: 'auto' }}>
            {subText}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
