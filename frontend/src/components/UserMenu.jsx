import { useState } from 'react';
import {
  Avatar, Box, Divider, ListItemIcon, Menu, MenuItem, Stack, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NEU_FG    = '#3D4852';
const NEU_MUTED = '#6B7280';
const EXT_SM    = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const EXT_H     = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)';
const INSET_SM  = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const ROLE_LABEL = {
  BROKER:     'Broker',
  COMPLIANCE: 'Compliance Officer',
  MANAGER:    'Manager / Admin',
  FIRM_USER:  'Firm User',
};

function initialsFor(nameOrEmail = '') {
  const parts = nameOrEmail.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const single = parts[0] || nameOrEmail;
  return (single.slice(0, 2) || '?').toUpperCase();
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);

  if (!user) return null;

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
          pl: 1.5, pr: 1, py: 0.75,
          borderRadius: 999,
          cursor: 'pointer',
          backgroundColor: '#E0E5EC',
          boxShadow: open ? INSET_SM : EXT_SM,
          transition: 'box-shadow 0.25s ease',
          '&:hover': { boxShadow: open ? INSET_SM : EXT_H },
        }}
      >
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="body2" sx={{ lineHeight: 1.2, fontWeight: 600, color: NEU_FG }}>
            {user.fullName ?? user.email}
          </Typography>
          <Typography variant="caption" sx={{ color: NEU_MUTED, lineHeight: 1 }}>
            {ROLE_LABEL[user.role] ?? user.role}
          </Typography>
        </Box>
        <Avatar sx={{ width: 34, height: 34, fontSize: '0.82rem', fontWeight: 700 }}>
          {initialsFor(user.fullName ?? user.email)}
        </Avatar>
        <KeyboardArrowDownIcon
          fontSize="small"
          sx={{
            color: NEU_MUTED,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </Stack>

      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 220 } } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: NEU_FG }}>
            {user.fullName ?? user.email}
          </Typography>
          <Typography variant="caption" sx={{ color: NEU_MUTED }}>
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
