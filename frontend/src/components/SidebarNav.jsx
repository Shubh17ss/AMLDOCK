import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import { useAuth } from '../auth/AuthContext.jsx';
import { palette } from '../theme/theme.js';

function navConfigFor(role) {
  switch (role) {
    case 'BROKER':
      return [
        { label: 'Dashboard', to: '/app', icon: <DashboardIcon /> },
        { label: 'My deals', to: '/my-deals', icon: <DescriptionIcon /> },
        { label: 'New deal', to: '/deals/new', icon: <AddCircleOutlineIcon /> },
      ];
    case 'COMPLIANCE':
      return [
        { label: 'Dashboard', to: '/app', icon: <DashboardIcon /> },
        { label: 'Queue', to: '/queue', icon: <InboxIcon /> },
      ];
    case 'MANAGER':
      return [
        { label: 'Dashboard', to: '/app', icon: <DashboardIcon /> },
        { label: 'Queue', to: '/queue', icon: <InboxIcon /> },
        { label: 'Firms', to: '/admin/firms', icon: <BusinessIcon />, group: 'Admin' },
        { label: 'Users', to: '/admin/users', icon: <PeopleIcon />, group: 'Admin' },
        { label: 'Audit', to: '/admin/audit', icon: <HistoryIcon />, group: 'Admin' },
      ];
    case 'FIRM_USER':
      return [
        { label: 'Dashboard', to: '/app', icon: <DashboardIcon /> },
        { label: 'Firm deals', to: '/firm/deals', icon: <BusinessCenterIcon /> },
      ];
    default:
      return [{ label: 'Dashboard', to: '/app', icon: <DashboardIcon /> }];
  }
}

export function SidebarNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const items = navConfigFor(user?.role);

  // Group items: ungrouped first, then by group label.
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
              px: 1.5, color: palette.ink[500],
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
          (item.to !== '/app' && pathname.startsWith(item.to + '/'));
        return (
          <ListItem key={item.to} disablePadding sx={{ mb: 0.25 }}>
            <ListItemButton
              component={RouterLink}
              to={item.to}
              sx={{
                py: 0.9,
                color: active ? palette.trust[700] : palette.ink[700],
                backgroundColor: active ? palette.trust[100] : 'transparent',
                '&:hover': {
                  backgroundColor: active ? palette.trust[100] : palette.ink[100],
                },
                ...(active && {
                  boxShadow: `inset 3px 0 0 ${palette.trust[500]}`,
                }),
              }}
            >
              <ListItemIcon sx={{
                minWidth: 36,
                color: active ? palette.trust[600] : palette.ink[500],
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: active ? 600 : 500,
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
