import {
  AppBar, Box, CircularProgress, Drawer, Stack, Toolbar, Typography,
} from '@mui/material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { isBroker, isDealAuthor } from '../auth/roles.js';
import { SidebarNav } from './SidebarNav.jsx';
import { UserMenu } from './UserMenu.jsx';
import { ScopeSelector } from './dashboard/ScopeSelector.jsx';
import { BottomNav, BOTTOM_NAV_CLEARANCE, BROKER_NAV_CLEARANCE } from './BottomNav.jsx';
import { greeting, stamp } from '../pages/dashboard/greeting.js';
import { moduleTitleFor, DASHBOARD_PATH, DEALS_PATH } from '../navigation/moduleRegistry.jsx';
import { DashboardScopeProvider, useDashboardScope, isScopeExemptPath } from '../dashboard/DashboardScope.jsx';
import { ScopeRequiredDialog } from '../dashboard/ScopeRequiredDialog.jsx';
import { ColorModeProvider } from '../theme/ColorMode.jsx';
import { tokens, fonts } from '../theme/theme.js';

const SIDEBAR_WIDTH = 260;

const TITLE_BY_PATH_PREFIX = [
  ['/deals/new',   'New deal'],
  ['/deals/',      'Deal'],
  ['/firm/deals',  'Firm deals'],
  ['/settings/audit-log', 'Audit log'],
  ['/admin/audit', 'Audit log'],
  ['/profile',     'Profile'],
  ['/dashboard',   'Dashboard'],
  ['/app',         'Dashboard'],
];

function titleFor(pathname, role) {
  // The deal id sits in the middle of /deals/:id/edit, so this one can't be expressed as a
  // prefix like the rest of the table.
  if (/^\/deals\/\d+\/edit\/?$/.test(pathname)) return 'Edit deal';
  // One page, two honest names. DealService.readableDeals pins the list to `createdBy = me` for an
  // agent and to their branch for an ADMIN, so the register genuinely *is* a deal author's own
  // deals — and calling it "Listing Register" to the person who arrived via a tab labelled Deals
  // and a button labelled "My deals" would be the odd one out.
  if (pathname === DEALS_PATH && isDealAuthor(role)) return 'My deals';
  const match = TITLE_BY_PATH_PREFIX.find(([prefix]) => pathname.startsWith(prefix));
  if (match) return match[1];
  return moduleTitleFor(pathname) ?? 'AML·DOCK';
}

export function AppShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = titleFor(pathname, user?.role);

  // A broker's phone home swaps the page-title bar for a greeting — but only there. Everywhere else
  // a title is what the screen owes you, and on a deep page like /deals/123 a greeting would be
  // noise where the heading used to be.
  const broker = isBroker(user?.role);
  const brokerHome = broker && pathname === DASHBOARD_PATH;

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
        {brokerHome && <BrokerGreeting user={user} />}

        <AppBar
          position="sticky"
          // On the broker's home the greeting above replaces this bar — but only on a phone; the
          // desktop shell is unchanged, so the bar has to come back at md.
          sx={brokerHome ? { display: { xs: 'none', md: 'flex' } } : undefined}
        >
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
            position: 'relative',
            p: { xs: 2, md: 4 },
            // Room for whichever nav is mounted — the constants live with it so the two cannot
            // drift. The broker's pill floats clear of the bottom edge and so needs more.
            pb: { xs: broker ? BROKER_NAV_CLEARANCE : BOTTOM_NAV_CLEARANCE, md: 4 },
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
            <ScopedOutlet />
          </Box>
        </Box>
      </Box>

      {/* Bottom nav — mobile only */}
      <BottomNav />

      {/* Blocks everything until a single entity and branch are chosen. */}
      <ScopeRequiredDialog />
    </Box>
    </DashboardScopeProvider>
    </ColorModeProvider>
  );
}

/**
 * The broker's home header: a mono ledger stamp over a display-face greeting, with the avatar menu
 * on the right.
 *
 * <p>Deliberately not sticky. A greeting is worth the top of the screen once, on arrival; keeping it
 * pinned would spend a fifth of a phone's height on it forever. It also sidesteps the theme's
 * `MuiToolbar` `minHeight: 64px !important`, which any custom sticky bar here would have to fight.
 *
 * <p>The avatar is why the nav could drop its Profile tab — UserMenu already carries
 * "Profile & password" and "Sign out".
 */
function BrokerGreeting({ user }) {
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || null;

  return (
    <Box
      component="header"
      sx={{
        display: { xs: 'flex', md: 'none' },
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        pt: 2.5,
        pb: 0.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontFamily: fonts.mono, fontSize: '0.62rem', fontWeight: 500,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: tokens.muted, mb: 0.6,
        }}>
          {stamp()}
        </Typography>
        <Typography sx={{
          fontFamily: fonts.display, fontSize: '1.6rem', fontWeight: 700,
          letterSpacing: '-0.03em', lineHeight: 1.1, color: tokens.ink,
        }}>
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0, pt: 0.5 }}>
        <UserMenu compact />
      </Box>
    </Box>
  );
}

/**
 * The page, once there is a scope to render it in.
 *
 * <p>Holding the route back matters as much as showing the dialog: nearly every page fires its
 * queries on mount, and roughly a dozen dialogs post `realEstateFirmId` straight from the scope.
 * Letting them mount behind the backdrop would send exactly the unscoped requests this change
 * exists to stop, and the user cannot see the result anyway.
 *
 * <p>The exception is the routes where a scope that cannot be satisfied gets repaired — see
 * isScopeExemptPath. Those pages read no scope, so there is nothing to hold back, and holding them
 * back is what turned "choose an entity" into a trap for the one account with no entity to choose.
 *
 * <p>Lives here rather than in AppShell itself because AppShell renders the provider and so sits
 * outside it. It calls useLocation() of its own rather than taking a prop: AppShell's own call is
 * for the page title, and threading the pathname down would couple two unrelated readers.
 */
function ScopedOutlet() {
  const { scopeComplete } = useDashboardScope();
  const { pathname } = useLocation();
  if (!scopeComplete && !isScopeExemptPath(pathname)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  return <Outlet />;
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
