import { Box, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { navProfileFor } from '../auth/roles.js';
import { tokens, shadows } from '../theme/theme.js';

const NEU_BASE   = tokens.tile;
const NEU_ACCENT = tokens.blue;
const NEU_MUTED  = tokens.muted;

function navItemsFor(role) {
  switch (navProfileFor(role)) {
    case 'agent': return [
      { label: 'Home',     to: '/dashboard', Icon: HomeIcon },
      { label: 'My Deals', to: '/my-deals',  Icon: DealsIcon },
      { label: 'New',      to: '/deals/new', Icon: PlusIcon,  accent: true },
      { label: 'Profile',  to: '/profile',   Icon: ProfileIcon },
    ];
    case 'salesManager': return [
      { label: 'Home',   to: '/dashboard',    Icon: HomeIcon },
      { label: 'Deals',  to: '/firm/deals',   Icon: DealsIcon },
      { label: 'Users',  to: '/branch-users', Icon: ProfileIcon },
      { label: 'Profile',to: '/profile',      Icon: ProfileIcon },
    ];
    case 'firmReviewer': return [
      { label: 'Home',    to: '/dashboard', Icon: HomeIcon },
      { label: 'Deals',   to: '/cdd/deals', Icon: QueueIcon },
      { label: 'Firm',    to: '/my-firm', Icon: DealsIcon },
      { label: 'Profile', to: '/profile', Icon: ProfileIcon },
    ];
    case 'root': return [
      { label: 'Home',    to: '/dashboard', Icon: HomeIcon },
      { label: 'Deals',   to: '/cdd/deals', Icon: QueueIcon },
      { label: 'Profile', to: '/profile', Icon: ProfileIcon },
    ];
    default: return [
      { label: 'Home',    to: '/dashboard', Icon: HomeIcon },
      { label: 'Profile', to: '/profile', Icon: ProfileIcon },
    ];
  }
}

function isActive(pathname, to) {
  if (to === '/app') return pathname === '/app';
  return pathname === to || pathname.startsWith(to + '/');
}

export function BottomNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const items = navItemsFor(user?.role);

  return (
    <Box
      component="nav"
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        backgroundColor: 'rgba(255,255,255,0.9)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderTop: `1px solid ${tokens.hairline}`,
        boxShadow: '0 -2px 14px rgba(16,24,40,0.06)',
        px: 1,
        pt: 1,
        pb: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
      }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.to);

        if (item.accent) {
          return (
            <Box
              key={item.to}
              component={RouterLink}
              to={item.to}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                textDecoration: 'none',
                mb: 0.5,
              }}
            >
              <Box sx={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                backgroundColor: NEU_ACCENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: shadows.md,
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                transform: 'translateY(-10px)',
                '&:active': { transform: 'translateY(-8px)' },
              }}>
                <item.Icon color="#fff" size={22} />
              </Box>
              <Typography sx={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: NEU_ACCENT,
                letterSpacing: '0.03em',
                lineHeight: 1,
                mt: '-6px',
              }}>
                {item.label}
              </Typography>
            </Box>
          );
        }

        return (
          <Box
            key={item.to}
            component={RouterLink}
            to={item.to}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              minWidth: 52,
              py: 0.5,
            }}
          >
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              backgroundColor: active ? tokens.blueWash : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
            }}>
              <item.Icon
                color={active ? NEU_ACCENT : NEU_MUTED}
                size={22}
                filled={active}
              />
            </Box>
            <Typography sx={{
              fontSize: '0.6rem',
              fontWeight: active ? 700 : 500,
              color: active ? NEU_ACCENT : NEU_MUTED,
              letterSpacing: '0.02em',
              lineHeight: 1,
              transition: 'color 0.2s ease',
            }}>
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Premium stroke icons ───────────────────────────────────────────────────────

function HomeIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H15v-5a1 1 0 00-1-1h-4a1 1 0 00-1 1v5H4a1 1 0 01-1-1V10.5z"
        fill={filled ? `${color}22` : 'none'}
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DealsIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x="4" y="4" width="12" height="15" rx="2"
        fill={filled ? `${color}22` : 'none'}
        stroke={color} strokeWidth="1.75"
      />
      <path d="M8 9h6M8 12h6M8 15h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="2" width="10" height="3" rx="1" fill={color} opacity="0.3" />
    </svg>
  );
}

function PlusIcon({ color = '#fff', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function QueueIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M22 12h-5.5l-1.5 3h-6l-1.5-3H2"
        stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.76 4H7.24A2 2 0 005.5 5.1z"
        fill={filled ? `${color}22` : 'none'}
        stroke={color} strokeWidth="1.75" strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="8" r="4"
        fill={filled ? `${color}22` : 'none'}
        stroke={color} strokeWidth="1.75"
      />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color} strokeWidth="1.75" strokeLinecap="round"
      />
    </svg>
  );
}
