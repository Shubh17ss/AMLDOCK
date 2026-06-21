import { AppBar, Avatar, Box, Drawer, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthContext.jsx';
import { roleLabel } from '../auth/roles.js';
import { SidebarNav } from './SidebarNav.jsx';
import { UserMenu, initialsFor } from './UserMenu.jsx';
import { BottomNav } from './BottomNav.jsx';
import { tokens } from '../theme/theme.js';

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
  ['/dashboard',   'Dashboard'],
  ['/app',         'Dashboard'],
];

function titleFor(pathname) {
  const match = TITLE_BY_PATH_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : 'AML·DOCK';
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pageTitle = titleFor(pathname);

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

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
            to={user ? '/dashboard' : '/'}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              px: 2.5, py: 2.5,
              textDecoration: 'none', color: 'inherit',
              borderBottom: `1px solid ${tokens.hairline}`,
            }}
          >
            <Box sx={{
              width: 38, height: 38, borderRadius: 2.5,
              background: `linear-gradient(140deg, ${tokens.blue}, ${tokens.blueDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldCheckIcon color="#fff" />
            </Box>
            <Box>
              <Typography sx={{
                fontWeight: 800, color: tokens.ink,
                letterSpacing: '0.08em', fontSize: '0.92rem',
                fontFamily: '"FK Grotesk Trial", "Plus Jakarta Sans", sans-serif',
              }}>
                AMLDOCK
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.muted, lineHeight: 1 }}>
                Compliance, calmer
              </Typography>
            </Box>
          </Box>

          <SidebarNav />

          {user && (
            <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.hairline}` }}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1, py: 0.5 }}>
                <Avatar sx={{ width: 34, height: 34, fontSize: '0.78rem', fontWeight: 700 }}>
                  {initialsFor(user.fullName ?? user.email)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.85rem', color: tokens.ink, lineHeight: 1.3 }}>
                    {user.fullName ?? user.email}
                  </Typography>
                  <Typography noWrap variant="caption" sx={{ color: tokens.muted, lineHeight: 1 }}>
                    {roleLabel(user.role)}
                  </Typography>
                </Box>
              </Stack>

              <Box
                component="button"
                onClick={handleSignOut}
                sx={{
                  mt: 1, width: '100%', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1, py: 0.85, borderRadius: '10px', backgroundColor: 'transparent',
                  color: tokens.muted, fontSize: '0.85rem', fontWeight: 600,
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  '&:hover': { backgroundColor: '#FCEAEA', color: tokens.rejected },
                }}
              >
                <LogoutIcon sx={{ fontSize: 18 }} />
                Sign out
              </Box>
            </Box>
          )}
        </Drawer>
      </Box>

      {/* Main column */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="sticky">
          <Toolbar sx={{gap: 2, minHeight: { xs: '56px !important', md: '64px !important'} }}>
            {/* Mobile: shield logo */}
            <Box
              component={RouterLink}
              to="/dashboard"
              sx={{
                display: { xs: 'flex', md: 'none' },
                alignItems: 'center',
                justifyContent: 'center',
                width: 36, height: 36, borderRadius: 2,
                background: `linear-gradient(140deg, ${tokens.blue}, ${tokens.blueDark})`,
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <ShieldCheckIcon color="#fff" />
            </Box>

            <Stack spacing={0} sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: tokens.muted, display: { xs: 'none', sm: 'block' } }}>
                {user ? roleDisplay(user.role) : ''}
              </Typography>
              <Typography variant="h6" noWrap sx={{ color: tokens.ink, fontWeight: 700 }}>
                {pageTitle}
              </Typography>
            </Stack>
            <UserMenu compact />
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 4 },
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

function ShieldCheckIcon({ color = tokens.blue }) {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2L3 5.5V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V5.5L10 2Z"
        fill={color === '#fff' ? 'rgba(255,255,255,0.15)' : 'rgba(27,95,227,0.12)'}
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M6.5 10L8.5 12L13.5 7.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
