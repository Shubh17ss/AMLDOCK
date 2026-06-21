import { useState } from 'react';
import {
  Avatar, Box, Divider, ListItemIcon, Menu, MenuItem, Stack, Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../auth/roles.js';
import { tokens, shadows } from '../theme/theme.js';

const NEU_FG    = tokens.ink;
const NEU_MUTED = tokens.muted;

const ROLE_LABEL = ROLE_LABELS;

export function initialsFor(nameOrEmail = '') {
  const parts = nameOrEmail.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const single = parts[0] || nameOrEmail;
  return (single.slice(0, 2) || '?').toUpperCase();
}

/** Top-right account menu. `compact` shows just the avatar acronym (menu functionality intact). */
export function UserMenu({ compact = false }) {
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
      {compact ? (
        <Avatar
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            width: 38, height: 38, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: open ? 'none' : shadows.sm,
            transition: 'box-shadow 0.2s ease, transform 0.1s ease',
            '&:hover': { boxShadow: shadows.md },
            '&:active': { transform: 'scale(0.96)' },
          }}
        >
          {initialsFor(user.fullName ?? user.email)}
        </Avatar>
      ) : (
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            pl: 1.5, pr: 1, py: 0.75,
            borderRadius: 999,
            cursor: 'pointer',
            backgroundColor: tokens.tile,
            border: `1px solid ${tokens.hairline}`,
            boxShadow: open ? 'none' : shadows.sm,
            transition: 'box-shadow 0.25s ease, border-color 0.2s ease',
            '&:hover': { borderColor: tokens.hairline2, boxShadow: shadows.md },
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
      )}

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
