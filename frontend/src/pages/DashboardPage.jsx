import { cloneElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { navConfigFor, DASHBOARD_PATH } from '../navigation/navConfig.jsx';

const NEU_ACCENT = '#6C63FF';

/** Landing hub: clickable tiles for each of the user's other menu options. */
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tiles = navConfigFor(user?.role).filter((item) => item.to !== DASHBOARD_PATH);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          {user?.fullName ? `Welcome, ${user.fullName}.` : 'Welcome.'} Choose where to go.
        </Typography>
      </Box>

      <Box sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
      }}>
        {tiles.map((item) => (
          <Card key={item.to} variant="outlined" sx={{ borderRadius: 3 }}>
            <CardActionArea onClick={() => navigate(item.to)} sx={{ height: '100%' }}>
              <Stack spacing={1.5} alignItems="center" justifyContent="center"
                     sx={{ py: 4, px: 2, textAlign: 'center' }}>
                <Box sx={{ color: NEU_ACCENT, display: 'flex' }}>
                  {cloneElement(item.icon, { sx: { fontSize: 44 } })}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{item.label}</Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
