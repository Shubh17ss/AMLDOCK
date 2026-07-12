import { useEffect, useState } from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { MODULE_GROUPS, DASHBOARD_PATH } from '../navigation/moduleRegistry.jsx';
import { ScopeSelector } from './dashboard/ScopeSelector.jsx';
import { tokens, fonts } from '../theme/theme.js';

const inGroup = (group, pathname) =>
  pathname === group.to || pathname.startsWith(group.to + '/') ||
  group.items.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'));

/**
 * Grouped compliance navigation, accordion-style: clicking a group header opens its
 * section (and navigates to the group landing — CDD opens the CDD Register). The
 * chevron toggles the dropdown without navigating. One group open at a time; the
 * group owning the active route opens automatically.
 */
export function SidebarNav() {
  const { pathname } = useLocation();
  const activeGroupName = MODULE_GROUPS.find((g) => inGroup(g, pathname))?.group ?? null;
  const [open, setOpen] = useState(activeGroupName);

  // Follow navigation: whatever group owns the current route is the open one.
  useEffect(() => {
    if (activeGroupName) setOpen(activeGroupName);
  }, [activeGroupName]);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
      {/* Workspace scope — travels with the user across every dashboard view. */}
      <Box sx={{ mb: 2, px: 0.25 }}>
        <Typography sx={{
          fontFamily: fonts.mono, fontSize: '0.6rem', fontWeight: 700,
          letterSpacing: '0.13em', textTransform: 'uppercase',
          color: tokens.muted, mb: 0.75, px: 1.25,
        }}>
          Scope
        </Typography>
        <ScopeSelector stacked />
      </Box>

      <NavList
        items={[{ id: 'dashboard', label: 'Dashboard', to: DASHBOARD_PATH, icon: <DashboardIcon /> }]}
        pathname={pathname}
      />

      {MODULE_GROUPS.map((group) => {
        const isOpen = open === group.group;
        const groupActive = inGroup(group, pathname);
        return (
          <Box key={group.group} sx={{ mt: 1.25 }}>
            <Box
              component={RouterLink}
              to={group.to}
              onClick={() => setOpen(group.group)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 0.9, borderRadius: 2.5, textDecoration: 'none',
                fontFamily: fonts.mono, fontSize: '0.64rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: groupActive ? tokens.blue : tokens.muted,
                // Depth: the open header reads as a raised control, not a printed label.
                background: isOpen ? 'linear-gradient(180deg, #FFFFFF 0%, #F6F9FE 100%)' : 'transparent',
                border: `1px solid ${isOpen ? tokens.hairline : 'transparent'}`,
                boxShadow: isOpen ? '0 2px 6px -2px rgba(16,24,40,0.10)' : 'none',
                transition: 'color 0.15s ease, background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                '&:hover': { color: tokens.blue, backgroundColor: isOpen ? undefined : '#F2F5FA' },
              }}
            >
              <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{group.group}</Box>
              <Box
                component="span"
                role="button"
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${group.group}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(isOpen ? null : group.group);
                }}
                sx={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '7px', flexShrink: 0,
                  color: 'inherit',
                  transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), background-color 0.15s ease',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  '&:hover': { backgroundColor: tokens.blueWash },
                }}
              >
                <ExpandMoreIcon sx={{ fontSize: 17 }} />
              </Box>
            </Box>

            <Collapse in={isOpen} timeout={260} unmountOnExit>
              {/* Left hairline guide gives the open section its sense of depth. */}
              <Box sx={{ mt: 0.5, ml: 1.75, pl: 1, borderLeft: `1px solid ${tokens.hairline2}` }}>
                <NavList items={group.items} pathname={pathname} />
              </Box>
            </Collapse>
          </Box>
        );
      })}
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
