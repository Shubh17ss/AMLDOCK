import { useState } from 'react';
import {
  Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Stack, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { palette } from '../theme/theme.js';

const ROLE_LABEL = {
  BROKER: 'Broker',
  COMPLIANCE: 'Compliance Officer',
  MANAGER: 'Manager / Admin',
  FIRM_USER: 'Firm User',
};

function initialsFor(nameOrEmail = '') {
  const parts = nameOrEmail.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const single = parts[0] || nameOrEmail;
  return (single.slice(0, 2) || '?').toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);

  if (!user) return null;
  const open = Boolean(anchor);

  const handleLogout = async () => {
    setAnchor(null);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          pl: 1, pr: 0.75, py: 0.5,
          borderRadius: 999,
          cursor: 'pointer',
          border: `1px solid ${palette.ink[200]}`,
          backgroundColor: open ? palette.trust[50] : 'transparent',
          '&:hover': { backgroundColor: palette.trust[50] },
          transition: 'background-color 120ms ease',
        }}
      >
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' }, mb:2.5, padding:'0.2rem'}}>
          <Typography variant="body2" sx={{ lineHeight: 1.1, fontWeight: 600, color: palette.ink[900] }}>
            {user.fullName ?? user.email}
          </Typography>
          <Typography variant="caption" sx={{ color: palette.ink[500] }}>
            {ROLE_LABEL[user.role] ?? user.role}
          </Typography>
        </Box>
        <Avatar sx={{
          width: 36, height: 36,
          bgcolor: palette.trust[500],
          color: '#fff',
          fontSize: '0.85rem', fontWeight: 700,
        }}>
          {initialsFor(user.fullName ?? user.email)}
        </Avatar>
        <IconButton size="small" sx={{ p: 0.25 }} aria-label="Open user menu">
          <KeyboardArrowDownIcon fontSize="small" sx={{ color: palette.ink[500] }} />
        </IconButton>
      </Stack>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              mt: 1, minWidth: 220,
              borderRadius: 2,
              border: `1px solid ${palette.ink[200]}`,
              boxShadow: '0 12px 28px rgba(15, 42, 79, 0.12)',
            },
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {user.fullName ?? user.email}
          </Typography>
          <Typography variant="caption" sx={{ color: palette.ink[500] }}>
            {user.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); navigate('/profile'); }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          Profile & password
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
