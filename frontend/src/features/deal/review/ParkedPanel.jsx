import { Box, Stack, Typography } from '@mui/material';
import { tokens, fonts } from '../../../theme/theme.js';

/**
 * A section that exists in the navigation but has nothing behind it yet.
 *
 * <p>Says what will live here and stops. Nothing is styled to look pressable, because the one
 * thing worse than an empty section is an empty section that appears to be broken — a reviewer
 * who clicks a hopeful-looking button and gets nothing learns to distrust the whole screen.
 */
export function ParkedPanel({ title, children }) {
  return (
    <Box
      sx={{
        border: `1px dashed ${tokens.hairline2}`,
        borderRadius: 3,
        px: 3,
        py: 5,
        textAlign: 'center',
        backgroundColor: tokens.tile,
      }}
    >
      <Stack spacing={1} alignItems="center">
        <Typography
          sx={{
            fontFamily: fonts.mono,
            fontSize: '0.68rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tokens.muted,
          }}
        >
          Not built yet
        </Typography>
        <Typography sx={{ fontFamily: fonts.display, fontSize: '1.05rem', color: tokens.ink }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.muted, maxWidth: 460 }}>
          {children}
        </Typography>
      </Stack>
    </Box>
  );
}
