import { Box, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { isBroker, navProfileFor } from '../auth/roles.js';
import { DEALS_PATH } from '../navigation/moduleRegistry.jsx';
import { tokens, shadows, fonts, motion } from '../theme/theme.js';

const NEU_ACCENT = tokens.blue;
const NEU_MUTED  = tokens.muted;

/**
 * How much room the page has to leave at its bottom so nothing hides behind the nav.
 *
 * <p>Exported because AppShell's `<main>` padding has to agree with whatever this file renders, and
 * the two used to drift: the padding was a bare `80px` matching a flush bar that no longer exists
 * for every role. The broker pill floats, so it needs its own height plus the gap beneath it.
 */
export const BOTTOM_NAV_CLEARANCE = 'calc(80px + env(safe-area-inset-bottom, 0px))';

// ── Broker pill geometry ────────────────────────────────────────────────────
// Exported as parts so the clearance below is derived rather than asserted, and because the tab
// layout below has to add up to the track height exactly — see NAV_LABEL_HEIGHT.
export const NAV_PILL_HEIGHT = 60;   // the pill itself
export const NAV_PILL_INSET  = 14;   // its float above the bottom edge, and its side margins
export const NAV_PILL_MAXW   = 300;  // narrow, so the round marker reads as a mark and not a slab
export const NAV_CAPSULE_PAD = 5;    // pill padding; the track insets by exactly this
export const BROKER_NAV_CLEARANCE =
  `calc(${NAV_PILL_HEIGHT + NAV_PILL_INSET + 16}px + env(safe-area-inset-bottom, 0px))`;

// The marker is a circle behind the icon alone, so the icon well and the label have fixed heights
// that fill the 50px track exactly (38 + 2 + 10). That is what lets the marker be positioned at
// `top: 0` instead of being centred against a content block whose height it would have to guess.
const NAV_TRACK_HEIGHT = NAV_PILL_HEIGHT - NAV_CAPSULE_PAD * 2;  // 50
const NAV_ICON_WELL    = 38;
const NAV_LABEL_GAP    = 2;
const NAV_LABEL_HEIGHT = NAV_TRACK_HEIGHT - NAV_ICON_WELL - NAV_LABEL_GAP;  // 10

// ── Broker nav ──────────────────────────────────────────────────────────────
// Three tabs, because a broker on a phone does three things.
//
// A tab owns a territory, not a path. The Deals tab is the Listing Register itself — for an agent
// the server pins the list to `createdBy = me` (DealService.readableDeals), so the register already
// *is* their deals — plus `/deals/*`, where one is created, read and edited. Those share no prefix
// with DEALS_PATH, so without the explicit claim the nav would go blank the moment someone opened a
// deal. `/profile` is claimed by nobody on purpose: it is reached from the avatar, so lighting a tab
// would misreport where you are.
const owns = (...prefixes) => (p) => prefixes.some((x) => p === x || p.startsWith(`${x}/`));

const BROKER_ITEMS = [
  { label: 'Home',     to: '/dashboard',   Icon: HomeIcon,     match: owns('/dashboard', '/app') },
  { label: 'Deals',    to: DEALS_PATH,     Icon: DealsIcon,    match: owns(DEALS_PATH, '/deals') },
  { label: 'Learning', to: '/my-training', Icon: LearningIcon, match: owns('/my-training') },
];

function navItemsFor(role) {
  switch (navProfileFor(role)) {
    case 'agent': return [
      { label: 'Home',     to: '/dashboard', Icon: HomeIcon },
      { label: 'Deals',    to: DEALS_PATH,   Icon: DealsIcon },
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
      { label: 'Firm',    to: '/settings/reporting-entities', Icon: DealsIcon },
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

  if (isBroker(user?.role)) return <BrokerNav pathname={pathname} />;

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

/**
 * The broker's nav: an ink capsule floating clear of the screen edges, the active tab marked by a
 * white capsule rather than by a colour change.
 *
 * <p>The capsule is one absolutely-positioned element moved with `translateX`, not a background on
 * whichever tab happens to be active. That is what lets it travel between tabs — a single
 * composited property, so the movement stays smooth on a phone and reduced motion can switch it off
 * by removing one transition. The three tabs are equal thirds precisely so the maths is
 * `index * 100%` and nothing has to be measured.
 */
function BrokerNav({ pathname }) {
  const index = BROKER_ITEMS.findIndex((i) => i.match(pathname));

  return (
    <Box
      component="nav"
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        // The safe-area inset belongs here, not in the pill's own padding: adding it inside would
        // inflate the pill's height on an iPhone and pull the 999px geometry out of true.
        bottom: `calc(${NAV_PILL_INSET}px + env(safe-area-inset-bottom, 0px))`,
        left: NAV_PILL_INSET,
        right: NAV_PILL_INSET,
        maxWidth: NAV_PILL_MAXW,
        mx: 'auto',
        height: NAV_PILL_HEIGHT,
        boxSizing: 'border-box',
        zIndex: 1200,
        // Explicit px/999px strings throughout: theme.shape.borderRadius is 12 and MUI multiplies a
        // numeric sx borderRadius by it, so `borderRadius: 2` would silently mean 24px.
        borderRadius: '999px',
        backgroundColor: tokens.navPillBg,
        boxShadow: '0 10px 30px -8px rgba(16,24,40,0.45), 0 2px 8px -2px rgba(16,24,40,0.25)',
        p: `${NAV_CAPSULE_PAD}px`,
      }}
    >
      {/*
        An inner, UNPADDED track. Not cosmetic: an absolutely-positioned element sizes its
        percentages against the containing block's *padding* box, while flex children divide the
        *content* box. Put the padding and the marker on the same element and the marker ends up
        wider than a tab and drifts further out of line with every step. Here both resolve against
        the same box, so `width: 100%/3` and `translateX(n * 100%)` are exactly one tab.
      */}
      <Box sx={{ position: 'relative', height: '100%', display: 'flex' }}>
        {/*
          Two elements, on purpose. The outer one is a full third of the track and is the thing that
          travels, so the slide stays `translateX(n * 100%)` with no measuring. The circle is its
          centred child, free to be any diameter without that arithmetic changing — which is what
          lets the marker be a mark behind the icon rather than a slab behind the whole tab.
        */}
        <Box
          aria-hidden
          sx={motion.respectful({
            position: 'absolute',
            top: 0, left: 0,
            width: 'calc(100% / 3)',
            height: NAV_ICON_WELL,
            display: 'grid',
            placeItems: 'center',
            // Some routes belong to no tab — /profile is reached from the avatar, not from here.
            // The marker hides rather than sliding to a tab that would be lying about where you
            // are, and `max(index, 0)` keeps it from flying off the left edge on -1.
            transform: `translateX(${Math.max(index, 0) * 100}%)`,
            opacity: index < 0 ? 0 : 1,
            transition: `transform ${motion.enter} ${motion.ease}, opacity ${motion.swift} linear`,
          })}
        >
          <Box sx={{
            width: NAV_ICON_WELL,
            height: NAV_ICON_WELL,
            borderRadius: '50%',
            backgroundColor: tokens.navPillMarker,
          }} />
        </Box>

        {BROKER_ITEMS.map((item, i) => {
          const active = i === index;
          return (
            <Box
              key={item.to}
              component={RouterLink}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              sx={{
                position: 'relative',
                zIndex: 1,
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: `${NAV_LABEL_GAP}px`,
                textDecoration: 'none',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2, borderRadius: '999px' },
              }}
            >
              {/* Fixed-height well: it is what the circle is drawn against, and together with the
                  label height it fills the track exactly, so the marker needs no vertical maths. */}
              <Box sx={{
                height: NAV_ICON_WELL,
                display: 'grid',
                placeItems: 'center',
                // Black on the white circle when active; the label below keeps its own colour,
                // since the marker sits behind the icon and not behind the whole tab.
                color: active ? tokens.navPillBg : tokens.navPillIdle,
                transition: `color ${motion.swift} ease`,
              }}>
                <item.Icon color="currentColor" size={21} filled={active} />
              </Box>
              <Typography
                component="span"
                sx={{
                  fontFamily: fonts.body,
                  fontSize: '0.58rem',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.02em',
                  height: NAV_LABEL_HEIGHT,
                  lineHeight: `${NAV_LABEL_HEIGHT}px`,
                  color: active ? tokens.navPillMarker : tokens.navPillIdle,
                  transition: `color ${motion.swift} ease`,
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Premium stroke icons ───────────────────────────────────────────────────────

function HomeIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H15v-5a1 1 0 00-1-1h-4a1 1 0 00-1 1v5H4a1 1 0 01-1-1V10.5z"
        fill={filled ? `color-mix(in srgb, ${color} 13%, transparent)` : 'none'}
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
        fill={filled ? `color-mix(in srgb, ${color} 13%, transparent)` : 'none'}
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
        fill={filled ? `color-mix(in srgb, ${color} 13%, transparent)` : 'none'}
        stroke={color} strokeWidth="1.75" strokeLinejoin="round"
      />
    </svg>
  );
}

/** An open book — training here is sessions attended and courses worked through, not a certificate. */
function LearningIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 7.5C10.5 6 8.5 5.25 5 5.25A1 1 0 004 6.25v11a1 1 0 001 1c3.5 0 5.5.75 7 2.25 1.5-1.5 3.5-2.25 7-2.25a1 1 0 001-1v-11a1 1 0 00-1-1c-3.5 0-5.5.75-7 2.25z"
        fill={filled ? `color-mix(in srgb, ${color} 13%, transparent)` : 'none'}
        stroke={color} strokeWidth="1.75" strokeLinejoin="round"
      />
      <path d="M12 7.5v13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ color = '#6B7280', size = 22, filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="8" r="4"
        fill={filled ? `color-mix(in srgb, ${color} 13%, transparent)` : 'none'}
        stroke={color} strokeWidth="1.75"
      />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color} strokeWidth="1.75" strokeLinecap="round"
      />
    </svg>
  );
}
