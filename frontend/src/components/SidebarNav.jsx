import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { getFirm } from '../api/firms.js';
import { navConfigFor, DASHBOARD_PATH } from '../navigation/navConfig.jsx';

const NEU_ACCENT  = '#6C63FF';
const NEU_FG      = '#3D4852';
const NEU_MUTED   = '#6B7280';
const EXT_SM      = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET_SM    = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

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
              px: 1.5, color: NEU_MUTED,
              fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
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
              sx={{
                py: 0.9,
                borderRadius: 2,
                backgroundColor: '#E0E5EC',
                color: active ? NEU_ACCENT : NEU_FG,
                boxShadow: active ? EXT_SM : 'none',
                transition: 'box-shadow 0.25s ease, color 0.25s ease',
                '&:hover': {
                  backgroundColor: '#E0E5EC',
                  boxShadow: active ? EXT_SM : INSET_SM,
                },
              }}
            >
              <ListItemIcon sx={{
                minWidth: 36,
                color: active ? NEU_ACCENT : NEU_MUTED,
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.9rem',
                }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
