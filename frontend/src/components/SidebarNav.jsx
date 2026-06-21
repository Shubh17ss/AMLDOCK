import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { getFirm } from '../api/firms.js';
import { navConfigFor, DASHBOARD_PATH } from '../navigation/navConfig.jsx';
import { tokens } from '../theme/theme.js';

export function SidebarNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const firmId = user?.realEstateFirmId;
  const firmQ = useQuery({
    queryKey: ['firm', firmId],
    queryFn: () => getFirm(firmId),
    enabled: Boolean(firmId),
  });
  const items = navConfigFor(user?.role).map((item) => (
    item.to === '/my-firm' && firmQ.data?.name ? { ...item, label: firmQ.data.name } : item
  ));

  const ungrouped = items.filter((i) => !i.group);
  const grouped = items.reduce((acc, item) => {
    if (item.group) (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
      <NavList items={ungrouped} pathname={pathname} />
      {Object.entries(grouped).map(([label, list]) => (
        <Box key={label} sx={{ mt: 3 }}>
          <Typography
            variant="caption"
            sx={{
              px: 1.5, color: tokens.muted,
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.66rem',
            }}
          >
            {label}
          </Typography>
          <NavList items={list} pathname={pathname} sx={{ mt: 0.5 }} />
        </Box>
      ))}
    </Box>
  );
}

function NavList({ items, pathname, sx }) {
  return (
    <List disablePadding sx={{ ...sx }}>
      {items.map((item) => {
        const active =
          pathname === item.to ||
          (item.to !== DASHBOARD_PATH && pathname.startsWith(item.to + '/'));
        return (
          <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={RouterLink}
              to={item.to}
              selected={active}
              sx={{
                py: 0.9,
                borderRadius: 2.5,
                color: active ? tokens.blue : tokens.ink,
                '&.Mui-selected': { backgroundColor: tokens.blueWash, color: tokens.blue },
                '&.Mui-selected:hover': { backgroundColor: tokens.blueWash },
                '&:hover': { backgroundColor: '#F2F5FA' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: active ? tokens.blue : tokens.muted }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: '0.9rem' }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
