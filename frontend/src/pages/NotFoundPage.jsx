import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h3">404</Typography>
        <Typography color="text.secondary">Page not found.</Typography>
        <Button component={RouterLink} to="/" variant="contained">Go home</Button>
      </Stack>
    </Box>
  );
}
