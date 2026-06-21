import { createTheme } from '@mui/material';

// ── "Clearance" design tokens — Apple-flat, white canvas / blue primary / ink ──
// Replaces the previous purple neumorphic system. White surfaces, soft single-source
// shadows, 1px hairlines, a confident blue primary, near-black ink, and FK Grotesk
// (display + mono "ledger" voice). Tokens are re-exported for components that need them.
export const tokens = {
  canvas:    '#FFFFFF',
  tile:      '#FFFFFF',
  hairline:  '#E7ECF3',
  hairline2: '#D7DEEA',
  ink:       '#111111',
  muted:     '#5A6576',
  blue:      '#1B5FE3',
  blueDark:  '#1648B0',
  blueWash:  '#EAF1FE',
  // Deal-status semantics (used only where a status is actually shown).
  draft:     '#64748B',
  submitted: '#1B5FE3',
  review:    '#B45309',
  approved:  '#15803D',
  rejected:  '#DC2626',
};

const T = tokens;

// Apple-style soft elevation (single light source — no neumorphic dual shadow).
export const shadows = {
  sm:   '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.10)',
  md:   '0 1px 3px rgba(16,24,40,0.07), 0 8px 24px rgba(16,24,40,0.09)',
  lg:   '0 4px 10px rgba(16,24,40,0.09), 0 20px 48px rgba(16,24,40,0.15)',
  focus:'0 0 0 3px rgba(27,95,227,0.22)',
};

// Typography roles.
export const fonts = {
  display: '"FK Grotesk Trial", "Plus Jakarta Sans", system-ui, sans-serif',
  body:    '"DM Sans", system-ui, -apple-system, sans-serif',
  mono:    '"FK Grotesk Mono Trial", ui-monospace, "SFMono-Regular", monospace',
};

// Legacy palette tokens — kept so components that still import { palette } compile.
const trust = {
  50: '#f3f7fb', 100: '#e1ecf6', 200: '#bfd6ea', 300: '#94b8d8',
  400: '#5e8fbe', 500: '#1f4b7a', 600: '#173a61', 700: '#102d4c',
  800: '#0a1f37', 900: '#06152a',
};
const ink = {
  900: '#0f172a', 700: '#334155', 500: '#64748b', 300: '#cbd5e1',
  200: '#e2e8f0', 100: '#eef2f7', 50: '#f8fafc',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: T.blue, dark: T.blueDark, light: '#4F86F0', contrastText: '#fff' },
    secondary:  { main: T.ink, dark: '#111111', light: '#39414F', contrastText: '#fff' },
    background: { default: T.canvas, paper: T.tile },
    text:       { primary: T.ink, secondary: T.muted },
    divider:    T.hairline,
    error:      { main: T.rejected, contrastText: '#fff' },
    warning:    { main: T.review, contrastText: '#fff' },
    success:    { main: T.approved, contrastText: '#fff' },
    info:       { main: T.blue, contrastText: '#fff' },
  },

  shape: { borderRadius: 12 },

  typography: {
    fontFamily: fonts.body,
    h1: { fontFamily: fonts.display, fontWeight: 800, letterSpacing: '-0.025em' },
    h2: { fontFamily: fonts.display, fontWeight: 800, letterSpacing: '-0.025em' },
    h3: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.02em' },
    h4: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.015em' },
    h6: { fontFamily: fonts.display, fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    body1: { color: T.ink },
    body2: { color: T.muted },
    caption: { color: T.muted },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: T.canvas, color: T.ink },
        '*::selection': { backgroundColor: T.blueWash },
      },
    },

    // ── Paper / Card ──────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: T.tile,
          backgroundImage: 'none',
          boxShadow: shadows.md,
          border: `1px solid ${T.hairline}`,
          borderRadius: 18,
        },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'elevation' },
      styleOverrides: {
        root: {
          backgroundColor: T.tile,
          backgroundImage: 'none',
          boxShadow: shadows.md,
          border: `1px solid ${T.hairline}`,
          borderRadius: 20,
          transition: 'box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 24, '&:last-child': { paddingBottom: 24 } } },
    },

    // ── App bar ───────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(180%) blur(12px)',
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: `1px solid ${T.hairline}`,
          color: T.ink,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: { root: { minHeight: '64px !important' } },
    },

    // ── Drawer (sidebar) ──────────────────────────────────────────────────────
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: T.tile,
          backgroundImage: 'none',
          borderRight: `1px solid ${T.hairline}`,
          boxShadow: 'none',
          borderRadius: 0,
        },
      },
    },

    // ── Buttons ───────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 16,
          paddingBlock: 8,
          boxShadow: 'none',
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.05s ease',
          '&:active': { transform: 'translateY(0.5px)' },
          '&.Mui-focusVisible': { boxShadow: shadows.focus },
        },
        containedPrimary: {
          backgroundColor: T.blue,
          color: '#fff',
          boxShadow: shadows.sm,
          '&:hover': { backgroundColor: T.blueDark, boxShadow: shadows.md },
          '&.Mui-disabled': { backgroundColor: '#C5D2EC', color: '#fff' },
        },
        containedSecondary: {
          backgroundColor: T.ink,
          color: '#fff',
          '&:hover': { backgroundColor: '#111111' },
        },
        outlined: {
          backgroundColor: T.tile,
          borderColor: T.hairline2,
          color: T.ink,
          '&:hover': { borderColor: T.blue, backgroundColor: T.blueWash },
        },
        text: {
          color: T.blue,
          '&:hover': { backgroundColor: T.blueWash },
        },
        sizeSmall: { borderRadius: 10, paddingInline: 12, paddingBlock: 5 },
        sizeLarge: { borderRadius: 14, paddingInline: 22, paddingBlock: 12, fontSize: '1rem' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          color: T.muted,
          transition: 'background-color 0.2s ease, color 0.2s ease',
          '&:hover': { backgroundColor: 'rgba(14,19,32,0.05)', color: T.ink },
          '&.Mui-focusVisible': { boxShadow: shadows.focus },
        },
      },
    },

    // ── Inputs ────────────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: T.tile,
          borderRadius: 12,
          transition: 'box-shadow 0.2s ease',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: T.hairline2 },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#B7C2D6' },
          '&.Mui-focused': { boxShadow: shadows.focus },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.blue, borderWidth: 1.5 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: T.rejected },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: T.muted,
          '&.Mui-focused': { color: T.blue },
          '&.Mui-error':   { color: T.rejected },
        },
      },
    },
    MuiSelect: {
      styleOverrides: { root: { backgroundColor: T.tile } },
    },

    // ── Chips — soft tonal badges ──────────────────────────────────────────────
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 700, borderRadius: 8, fontSize: '0.7rem', border: 'none', letterSpacing: '0.01em' },
        sizeSmall: { height: 22 },
        colorDefault: { backgroundColor: '#EEF1F6', color: T.muted },
        colorInfo:    { backgroundColor: T.blueWash, color: T.blueDark },
        colorPrimary: { backgroundColor: T.blueWash, color: T.blueDark },
        colorWarning: { backgroundColor: '#FEF3E2', color: T.review },
        colorSuccess: { backgroundColor: '#E6F4EC', color: T.approved },
        colorError:   { backgroundColor: '#FCEAEA', color: T.rejected },
      },
    },

    // ── Lists / Nav ───────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background-color 0.2s ease, color 0.2s ease',
          '&:hover': { backgroundColor: '#F2F5FA' },
          '&.Mui-selected': {
            backgroundColor: T.blueWash,
            color: T.blue,
            '&:hover': { backgroundColor: T.blueWash },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 36, color: 'inherit' } },
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: T.tile,
          backgroundImage: 'none',
          boxShadow: shadows.sm,
          border: `1px solid ${T.hairline}`,
          borderRadius: 16,
        },
      },
    },
    MuiTable: {
      styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: '#FBFCFE',
            color: T.muted,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.7rem',
            borderBottom: `1px solid ${T.hairline}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          borderBottom: `1px solid ${T.hairline}`,
          color: T.ink,
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
        head: { paddingTop: 10, paddingBottom: 10 },
        sizeSmall: { padding: '8px 12px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&.MuiTableRow-hover:hover': { backgroundColor: '#F5F8FD' },
          '&:last-child .MuiTableCell-root': { borderBottom: 'none' },
        },
      },
    },

    // ── Menus ─────────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: T.tile,
          backgroundImage: 'none',
          boxShadow: shadows.lg,
          borderRadius: 14,
          border: `1px solid ${T.hairline}`,
          marginTop: 8,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 6px',
          transition: 'background-color 0.15s ease',
          '&:hover': { backgroundColor: '#F2F5FA' },
          '&.Mui-selected': { backgroundColor: T.blueWash, color: T.blue },
        },
      },
    },

    // ── Alerts ────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: '1px solid transparent', boxShadow: 'none' },
        standardError:   { backgroundColor: '#FCEAEA', color: '#9B1C1C', borderColor: '#F6D2D2' },
        standardSuccess: { backgroundColor: '#E6F4EC', color: '#106233', borderColor: '#CDE9D8' },
        standardInfo:    { backgroundColor: T.blueWash, color: T.blueDark, borderColor: '#D4E4FD' },
        standardWarning: { backgroundColor: '#FEF3E2', color: '#92400E', borderColor: '#FBE3C0' },
      },
    },

    // ── Tabs — clean segmented control ─────────────────────────────────────────
    MuiTabs: {
      styleOverrides: {
        root: {
          backgroundColor: '#F1F4F9',
          borderRadius: 999,
          padding: 4,
          minHeight: 40,
        },
        indicator: { height: '100%', borderRadius: 999, backgroundColor: T.tile, boxShadow: shadows.sm, zIndex: 0 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 600, minHeight: 32,
          borderRadius: 999, zIndex: 1, color: T.muted,
          transition: 'color 0.2s ease',
          '&.Mui-selected': { color: T.ink },
        },
      },
    },

    // ── Misc ─────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: { root: { borderColor: T.hairline } },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { backgroundColor: T.blue, color: '#fff', fontWeight: 700 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: T.ink, color: '#fff', fontSize: '0.72rem', borderRadius: 8, fontWeight: 500 },
        arrow: { color: T.ink },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: '#EAEEF4', borderRadius: 10 } },
    },
    MuiBadge: {
      styleOverrides: { badge: { backgroundColor: T.blue, color: '#fff' } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundColor: T.tile, boxShadow: shadows.lg, borderRadius: 20, border: `1px solid ${T.hairline}` },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { padding: 8 },
        track: { borderRadius: 22 / 2, backgroundColor: '#C7D0DE', opacity: 1 },
        thumb: { color: '#fff', boxShadow: '0 1px 2px rgba(16,24,40,0.3)' },
        switchBase: {
          color: '#fff',
          '&.Mui-checked': { color: '#fff' },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: T.blue, opacity: 1 },
        },
      },
    },

    // ── Date / Time Pickers ───────────────────────────────────────────────────
    MuiPickersPopper: {
      styleOverrides: {
        paper: {
          backgroundColor: T.tile, backgroundImage: 'none',
          boxShadow: shadows.lg, borderRadius: 16, border: `1px solid ${T.hairline}`,
        },
      },
    },
    MuiPickersCalendarHeader: {
      styleOverrides: { root: { color: T.ink }, label: { fontWeight: 700, color: T.ink } },
    },
    MuiDayCalendar: {
      styleOverrides: { weekDayLabel: { color: T.muted, fontWeight: 600 } },
    },
    MuiPickersDay: {
      styleOverrides: {
        root: {
          color: T.ink,
          borderRadius: 10,
          '&:hover': { backgroundColor: '#F2F5FA' },
          '&.Mui-selected': {
            backgroundColor: T.blue, color: '#fff',
            '&:hover': { backgroundColor: T.blueDark },
          },
          '&.MuiPickersDay-today': { border: `1.5px solid ${T.blue}`, backgroundColor: 'transparent' },
        },
      },
    },
    MuiClockPointer: {
      styleOverrides: { root: { backgroundColor: T.blue }, thumb: { backgroundColor: T.blue, border: `2px solid ${T.blue}` } },
    },
    MuiClock: {
      styleOverrides: { pin: { backgroundColor: T.blue } },
    },
    MuiClockNumber: {
      styleOverrides: { root: { color: T.ink, '&.Mui-selected': { backgroundColor: T.blue, color: '#fff' } } },
    },
    MuiPickersToolbar: {
      styleOverrides: { root: { color: T.ink } },
    },
  },
});

// Export legacy palette tokens for components that still import them.
export const palette = { trust, ink };
