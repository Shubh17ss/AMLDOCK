import { AppBar, Box, Drawer, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { palette } from '../theme/theme.js';
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
            border: 'none',
            backgroundColor: '#ffffff',
            // soft right-side shadow gives the depth effect
            boxShadow: '4px 0 16px rgba(15, 42, 79, 0.06), 1px 0 0 rgba(15, 42, 79, 0.04)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          component={RouterLink}
          to={user ? '/app' : '/'}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25,
            px: 2.5, py: 5.25,
            textDecoration: 'none', color: 'inherit',
            borderBottom: `1px solid ${palette.ink[100]}`,
          }}
        >
          <Box sx={{
            width: 32, height: 32, borderRadius: 1.5,
            background: `linear-gradient(135deg, ${palette.trust[500]} 0%, ${palette.trust[700]} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(15, 42, 79, 0.18)',
          }}>
            <Typography sx={{
              color: '#fff', fontWeight: 800, fontSize: '0.85rem',
              letterSpacing: '0.04em',
            }}>
              A
            </Typography>
          </Box>
          <Box>
            <Typography sx={{
              fontWeight: 700, color: palette.trust[800],
              letterSpacing: '0.12em', fontSize: '0.92rem',
            }}>
              AMLDOCK
            </Typography>
            <Typography variant="caption" sx={{ color: palette.ink[500], lineHeight: 1 }}>
              Compliance, calmer
            </Typography>
          </Box>
        </Box>

        <SidebarNav />

        <Box sx={{ p: 2, borderTop: `1px solid ${palette.ink[100]}` }}>
          <Typography variant="caption" sx={{ color: palette.ink[500] }}>
            © {new Date().getFullYear()} AML&middot;DOCK
          </Typography>
        </Box>
      </Drawer>

      {/* Main column: top bar + content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding:'1.4rem 0'}}>
        <AppBar position="sticky">
          <Toolbar sx={{ gap: 2 }}>
            <Stack spacing={0.1} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: palette.ink[500] }}>
                {user ? roleDisplay(user.role) : ''}
              </Typography>
              <Typography variant="h6" noWrap sx={{ color: palette.ink[900] }}>
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
    case 'BROKER': return 'Broker workspace';
    case 'COMPLIANCE': return 'Compliance workspace';
    case 'MANAGER': return 'Admin & oversight';
    case 'FIRM_USER': return 'Firm workspace';
    default: return '';
  }
}
