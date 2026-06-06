import { AppBar, Box, Drawer, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { SidebarNav } from './SidebarNav.jsx';
import { UserMenu } from './UserMenu.jsx';

const SIDEBAR_WIDTH = 260;

const TITLE_BY_PATH_PREFIX = [
  ['/my-deals', 'My deals'],
  ['/deals/new', 'New deal'],
  ['/deals/', 'Deal'],
  ['/queue', 'Compliance queue'],
  ['/firm/deals', 'Firm deals'],
  ['/admin/users', 'Users'],
  ['/admin/firms', 'Firms'],
  ['/admin/audit', 'Audit log'],
  ['/profile', 'Profile'],
  ['/app', 'Dashboard'],
];

function titleFor(pathname) {
  const match = TITLE_BY_PATH_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : 'AML·DOCK';
}

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = titleFor(pathname);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Brand lockup */}
        <Box
          component={RouterLink}
          to={user ? '/app' : '/'}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            px: 2.5, py: 2.5,
            textDecoration: 'none', color: 'inherit',
            boxShadow: 'inset 0 -1px 0 rgba(163,177,198,0.4)',
          }}
        >
          <Box sx={{
            width: 36, height: 36, borderRadius: 2,
            backgroundColor: '#E0E5EC',
            boxShadow: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ShieldCheckIcon />
          </Box>
          <Box>
            <Typography sx={{
              fontWeight: 800, color: '#3D4852',
              letterSpacing: '0.1em', fontSize: '0.9rem',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            }}>
              AMLDOCK
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', lineHeight: 1 }}>
              Compliance, calmer
            </Typography>
          </Box>
        </Box>

        <SidebarNav />

        <Box sx={{
          p: 2,
          boxShadow: 'inset 0 1px 0 rgba(163,177,198,0.4)',
        }}>
          <Typography variant="caption" sx={{ color: '#6B7280' }}>
            © {new Date().getFullYear()} AML&middot;DOCK
          </Typography>
        </Box>
      </Drawer>

      {/* Main column: top bar + content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '1.4rem 0' }}>
        <AppBar position="sticky">
          <Toolbar sx={{ gap: 2 }}>
            <Stack spacing={0.1} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                {user ? roleDisplay(user.role) : ''}
              </Typography>
              <Typography variant="h6" noWrap sx={{ color: '#3D4852', fontWeight: 700 }}>
                {pageTitle}
              </Typography>
            </Stack>
            <UserMenu />
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 3, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

function roleDisplay(role) {
  switch (role) {
    case 'BROKER':     return 'Broker workspace';
    case 'COMPLIANCE': return 'Compliance workspace';
    case 'MANAGER':    return 'Admin & oversight';
    case 'FIRM_USER':  return 'Firm workspace';
    default:           return '';
  }
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2L3 5.5V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V5.5L10 2Z"
        fill="rgba(108,99,255,0.15)" stroke="#6C63FF" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path
        d="M6.5 10L8.5 12L13.5 7.5"
        stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
