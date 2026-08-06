import { AppBar, Box, Drawer, IconButton, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { SidebarNav } from './SidebarNav.jsx';
import { UserMenu } from './UserMenu.jsx';
import { ScopeSelector } from './dashboard/ScopeSelector.jsx';
import { BottomNav } from './BottomNav.jsx';
import { moduleTitleFor } from '../navigation/moduleRegistry.jsx';
import { DashboardScopeProvider } from '../dashboard/DashboardScope.jsx';
import { ColorModeProvider, useColorMode } from '../theme/ColorMode.jsx';
import { tokens, fonts } from '../theme/theme.js';

const SIDEBAR_WIDTH = 260;

const TITLE_BY_PATH_PREFIX = [
  ['/my-deals',    'My deals'],
  ['/deals/new',   'New deal'],
  ['/deals/',      'Deal'],
  ['/firm/deals',  'Firm deals'],
  ['/admin/audit', 'Audit log'],
  ['/profile',     'Profile'],
  ['/dashboard',   'Dashboard'],
  ['/app',         'Dashboard'],
];

function titleFor(pathname) {
  const match = TITLE_BY_PATH_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  if (match) return match[1];
  return moduleTitleFor(pathname) ?? 'AML·DOCK';
}

/** Sun/moon toggle in the app bar — dashboard-only, hence inside ColorModeProvider. */
function ColorModeToggle() {
  const { mode, toggle } = useColorMode();
  const dark = mode === 'dark';
  return (
    <Tooltip title={dark ? 'Light mode' : 'Dark mode'}>
      <IconButton onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
        {dark ? <LightModeOutlinedIcon sx={{ fontSize: 20 }} />
              : <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />}
      </IconButton>
    </Tooltip>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = titleFor(pathname);

  return (
    <ColorModeProvider>
    <DashboardScopeProvider>
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tokens.canvas }}>

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
              background: tokens.sidebarHeadBg,
              boxShadow: '0 6px 16px -12px rgba(16,24,40,0.18)',
              position: 'relative', zIndex: 1,
            }}
          >
            <Box sx={{
              width: 38, height: 38, borderRadius: 2.5,
              background: `linear-gradient(140deg, ${tokens.blue}, ${tokens.blueDark})`,
              boxShadow: '0 4px 10px -3px rgba(27,95,227,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
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
                Compliance
              </Typography>
            </Box>
          </Box>

          <SidebarNav />

          {/* Workspace scope lives in the sidebar footer — it travels with the user across every
              view, and every register writes into whatever is selected here. The account details
              and sign-out it replaced are in the app-bar avatar menu. */}
          {user && (
            <Box sx={{ p: 1.5, borderTop: `1px solid ${tokens.hairline}` }}>
              <Typography sx={{
                fontFamily: fonts.mono, fontSize: '0.6rem', fontWeight: 700,
                letterSpacing: '0.13em', textTransform: 'uppercase',
                color: tokens.muted, mb: 0.75, px: 1.25,
              }}>
                Scope
              </Typography>
              <ScopeSelector stacked />
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
            <ColorModeToggle />
            <UserMenu compact />
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            position: 'relative',
            p: { xs: 2, md: 4 },
            pb: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', md: 4 },
          }}
        >
          {/* Ambient canvas wash — gives the frosted tiles something to blur. Oversized
              and slowly drifting so the glass reads alive; static under reduced motion. */}
          <Box aria-hidden sx={{
            position: 'fixed', inset: '-6%', zIndex: 0, pointerEvents: 'none',
            background: `
              radial-gradient(920px 480px at 88% -12%, rgba(27,95,227,0.10), transparent 62%),
              radial-gradient(720px 460px at -8% 110%, rgba(27,95,227,0.065), transparent 58%),
              radial-gradient(1100px 640px at 42% 34%, rgba(27,95,227,0.035), transparent 66%)
            `,
            animation: 'ambientDrift 48s ease-in-out infinite alternate',
            '@keyframes ambientDrift': {
              from: { transform: 'translate3d(0, 0, 0) scale(1)' },
              to:   { transform: 'translate3d(-1.5%, 1%, 0) scale(1.04)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }} />
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Outlet />
          </Box>
        </Box>
      </Box>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </Box>
    </DashboardScopeProvider>
    </ColorModeProvider>
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
    case 'AUDIT':                 return 'Audit — read only';
    case 'FINANCE':               return 'Finance workspace';
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
