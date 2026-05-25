import { AppBar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const ROLE_LABEL = {
  BROKER: 'Broker',
  COMPLIANCE: 'Compliance',
  MANAGER: 'Manager',
  FIRM_USER: 'Firm User',
};

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/"
                      sx={{ color: 'inherit', textDecoration: 'none', flexGrow: 1 }}>
            AML_DOCK
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {user?.role === 'BROKER' && (
              <Button color="inherit" component={RouterLink} to="/my-deals">My deals</Button>
            )}
            {(user?.role === 'COMPLIANCE' || user?.role === 'MANAGER') && (
              <Button color="inherit" component={RouterLink} to="/queue">Queue</Button>
            )}
            {user?.role === 'FIRM_USER' && (
              <Button color="inherit" component={RouterLink} to="/firm/deals">Deals</Button>
            )}
            {user?.role === 'MANAGER' && (
              <>
                <Button color="inherit" component={RouterLink} to="/admin/firms">Firms</Button>
                <Button color="inherit" component={RouterLink} to="/admin/users">Users</Button>
              </>
            )}
            <Button color="inherit" component={RouterLink} to="/profile">Profile</Button>
            {user && (
              <Chip
                label={`${user.fullName ?? user.email} · ${ROLE_LABEL[user.role] ?? user.role}`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white' }}
              />
            )}
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
