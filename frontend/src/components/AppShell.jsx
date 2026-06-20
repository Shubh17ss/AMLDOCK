import { AppBar, Box, Drawer, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { SidebarNav } from './SidebarNav.jsx';
import { UserMenu } from './UserMenu.jsx';
import { BottomNav } from './BottomNav.jsx';

const SIDEBAR_WIDTH = 260;

const TITLE_BY_PATH_PREFIX = [
  ['/my-deals',    'My deals'],
  ['/deals/new',   'New deal'],
  ['/deals/',      'Deal'],
  ['/queue',       'Compliance queue'],
  ['/firm/deals',  'Firm deals'],
  ['/admin/users', 'Users'],
  ['/admin/firms', 'Firms'],
  ['/admin/audit', 'Audit log'],
  ['/profile',     'Profile'],
  ['/app',         'Dashboard'],
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

      {/* Sidebar — desktop only */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, width: SIDEBAR_WIDTH, flexShrink: 0 }}>
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
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

          <Box sx={{ p: 2, boxShadow: 'inset 0 1px 0 rgba(163,177,198,0.4)' }}>
            <Typography variant="caption" sx={{ color: '#6B7280' }}>
              © {new Date().getFullYear()} AML&middot;DOCK
            </Typography>
          </Box>
        </Drawer>
      </Box>

      {/* Main column */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, pt: { xs: 0, md: '1.4rem' } }}>
        <AppBar position="sticky">
          <Toolbar sx={{ gap: 2, minHeight: { xs: '56px !important', md: '64px !important' } }}>
            {/* Mobile: shield logo */}
            <Box
              component={RouterLink}
              to="/app"
              sx={{
                display: { xs: 'flex', md: 'none' },
                alignItems: 'center',
                justifyContent: 'center',
                width: 36, height: 36, borderRadius: 1.5,
                backgroundColor: '#E0E5EC',
                boxShadow: '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <ShieldCheckIcon />
            </Box>

            <Stack spacing={0} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: '#6B7280', display: { xs: 'none', sm: 'block' } }}>
                {user ? roleDisplay(user.role) : ''}
              </Typography>
              <Typography variant="h6" noWrap sx={{ color: '#3D4852', fontWeight: 700 }}>
                {pageTitle}
              </Typography>
            </Stack>
            <UserMenu />
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
            // Pad bottom so content clears the fixed bottom nav on mobile
            pb: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', md: 4 },
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </Box>
  );
}

function roleDisplay(role) {
  switch (role) {
    case 'AGENT':
    case 'AGENT_PA':              return 'Agent workspace';
    case 'ADMIN':                 return 'Branch admin workspace';
    case 'SALES_MANAGER':         return 'Branch oversight';
    case 'AML_COMPLIANCE_OFFICER':return 'Compliance workspace';
    case 'SENIOR_MANAGER':        return 'Senior management';
    case 'ROOT':                  return 'Platform administration';
    default:                      return '';
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
