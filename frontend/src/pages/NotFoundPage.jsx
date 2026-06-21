import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens, shadows, fonts } from '../theme/theme.js';

export function NotFoundPage() {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', backgroundColor: tokens.canvas,
    }}>
      <Stack spacing={3} alignItems="center">
        {/* Big clearance numeral */}
        <Box sx={{
          width: 150, height: 150, borderRadius: '50%',
          backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`, boxShadow: shadows.md,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{
            fontFamily: fonts.display,
            fontWeight: 800, fontSize: '3rem', color: tokens.blue, letterSpacing: '-0.03em',
          }}>
            404
          </Typography>
        </Box>

        <Stack spacing={0.75} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.ink }}>
            Page not found
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            This page doesn&apos;t exist or was moved.
          </Typography>
        </Stack>

        <Button component={RouterLink} to="/" variant="contained" size="large">
          Go home
        </Button>
      </Stack>
    </Box>
  );
}
