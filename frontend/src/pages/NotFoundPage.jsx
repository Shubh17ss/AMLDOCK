import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const EXT    = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const INSET  = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';

export function NotFoundPage() {
  return (
    <Box sx={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', backgroundColor: '#E0E5EC',
    }}>
      <Stack spacing={3} alignItems="center">
        {/* Big extruded number */}
        <Box sx={{
          width: 160, height: 160, borderRadius: '50%',
          backgroundColor: '#E0E5EC', boxShadow: EXT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Box sx={{
            width: 120, height: 120, borderRadius: '50%',
            backgroundColor: '#E0E5EC', boxShadow: INSET,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              fontWeight: 800, fontSize: '2.5rem', color: '#6C63FF', letterSpacing: '-0.02em',
            }}>
              404
            </Typography>
          </Box>
        </Box>

        <Stack spacing={0.75} alignItems="center">
          <Typography variant="h5" sx={{
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontWeight: 700, color: '#3D4852',
          }}>
            Page not found
          </Typography>
          <Typography variant="body2" sx={{ color: '#6B7280' }}>
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
