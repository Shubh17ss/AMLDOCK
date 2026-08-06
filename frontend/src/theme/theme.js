import { createTheme } from '@mui/material';

// ── "Clearance" design tokens — Apple-flat, white canvas / blue primary / ink ──
// Every token is a CSS custom property reference into styles/theme-vars.css, which
// defines the light values on :root and the dark values under [data-theme="dark"].
// That attribute is owned by theme/ColorMode.jsx and only ever set inside the
// dashboard shell — so the same tokens read light on the static site and flip to
// dark in the workspace, without any component changing.
export const tokens = {
  canvas:    'var(--cl-canvas)',
  tile:      'var(--cl-tile)',
  tileRaised:'var(--cl-tile-raised)',
  hover:     'var(--cl-hover)',
  hairline:  'var(--cl-hairline)',
  hairline2: 'var(--cl-hairline2)',
  ink:       'var(--cl-ink)',
  muted:     'var(--cl-muted)',
  blue:      'var(--cl-blue)',
  blueDark:  'var(--cl-blue-dark)',
  blueWash:  'var(--cl-blue-wash)',
  // Composite surfaces the shell shares (whole gradient values, not colours).
  appbarBg:     'var(--cl-appbar-bg)',
  scopeBg:      'var(--cl-scope-bg)',
  scopeBgOff:   'var(--cl-scope-bg-off)',
  sidebarHeadBg:'var(--cl-sidebarhead-bg)',
  glassBg:      'var(--cl-glass-bg)',
  panelBg:      'var(--cl-panel-bg)',
  glassBorder:  'var(--cl-glass-border)',
  iconHover:    'var(--cl-icon-hover)',
  // Deal-status semantics (used only where a status is actually shown).
  draft:     'var(--cl-draft)',
  submitted: 'var(--cl-submitted)',
  review:    'var(--cl-review)',
  approved:  'var(--cl-approved)',
  rejected:  'var(--cl-rejected)',
};

const T = tokens;

// Elevation, also variable-backed: light carries white inset speculars that would
// read as hard lines on a dark tile, so the dark set swaps them for deeper ambient.
export const shadows = {
  sm:   'var(--cl-shadow-sm)',
  md:   'var(--cl-shadow-md)',
  lg:   'var(--cl-shadow-lg)',
  focus:'var(--cl-shadow-focus)',
  glass:      'var(--cl-shadow-glass)',
  glassHover: 'var(--cl-shadow-glass-hover)',
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
  // The palette keeps REAL hex values on purpose — every entry, including text and
  // divider. MUI runs colour math on them (augmentColor on the mains, and e.g.
  // Skeleton computes alpha(text.primary)) and THROWS on var() strings, killing the
  // whole route. Nothing visible depends on the palette: every surface is styled by
  // the overrides below, which use the variable-backed tokens and flip with the
  // theme. Never point a palette entry at `tokens`.
  palette: {
    mode: 'light',
    primary:    { main: '#1B5FE3', dark: '#1648B0', light: '#4F86F0', contrastText: '#fff' },
    secondary:  { main: '#242C3C', dark: '#1A2130', light: '#3A4356', contrastText: '#fff' },
    background: { default: '#FFFFFF', paper: '#FFFFFF' },
    text:       { primary: '#242C3C', secondary: '#5A6576' },
    divider:    '#E7ECF3',
    error:      { main: '#DC2626', contrastText: '#fff' },
    warning:    { main: '#B45309', contrastText: '#fff' },
    success:    { main: '#15803D', contrastText: '#fff' },
    info:       { main: '#1B5FE3', contrastText: '#fff' },
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
          backgroundColor: T.appbarBg,
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
          '&.Mui-disabled': { backgroundColor: 'var(--cl-disabled-blue)', color: '#fff' },
        },
        containedSecondary: {
          backgroundColor: T.ink,
          // Canvas, not #fff: in dark mode the ink surface flips light, and the
          // canvas token flips dark with it, so the label stays readable.
          color: T.canvas,
          '&:hover': { backgroundColor: '#1A2130' },
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
          '&:hover': { backgroundColor: T.iconHover, color: T.ink },
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
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--cl-input-hover-border)' },
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
          // Keep the floated label ink on focus so it stays legible against the
          // blue outline instead of merging into it (both were blue before).
          '&.Mui-focused': { color: T.ink },
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
        colorDefault: { backgroundColor: 'var(--cl-chip-neutral)', color: T.muted },
        colorInfo:    { backgroundColor: T.blueWash, color: T.blue },
        colorPrimary: { backgroundColor: T.blueWash, color: T.blue },
        colorWarning: { backgroundColor: 'var(--cl-warn-wash)', color: T.review },
        colorSuccess: { backgroundColor: 'var(--cl-ok-wash)', color: T.approved },
        colorError:   { backgroundColor: 'var(--cl-err-wash)', color: T.rejected },
      },
    },

    // ── Lists / Nav ───────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background-color 0.2s ease, color 0.2s ease',
          '&:hover': { backgroundColor: T.hover },
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
            backgroundColor: T.tileRaised,
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
          '&.MuiTableRow-hover:hover': { backgroundColor: T.hover },
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
          '&:hover': { backgroundColor: T.hover },
          '&.Mui-selected': { backgroundColor: T.blueWash, color: T.blue },
        },
      },
    },

    // ── Alerts ────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: '1px solid transparent', boxShadow: 'none' },
        standardError:   { backgroundColor: 'var(--cl-err-wash)', color: 'var(--cl-err-text)', borderColor: 'var(--cl-err-border)' },
        standardSuccess: { backgroundColor: 'var(--cl-ok-wash)', color: 'var(--cl-ok-text)', borderColor: 'var(--cl-ok-border)' },
        standardInfo:    { backgroundColor: T.blueWash, color: T.blue, borderColor: 'var(--cl-info-border)' },
        standardWarning: { backgroundColor: 'var(--cl-warn-wash)', color: 'var(--cl-warn-text)', borderColor: 'var(--cl-warn-border)' },
      },
    },

    // ── Tabs — segmented control, active pill in brand blue ───────────────────
    MuiTabs: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--cl-tab-track)',
          borderRadius: 999,
          padding: 5,
          minHeight: 48,
        },
        // The "indicator" is the pill sitting behind the active tab.
        indicator: {
          height: '100%',
          borderRadius: 999,
          backgroundColor: T.blue,
          boxShadow: shadows.sm,
          zIndex: 0,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 600, fontSize: '0.9rem',
          minHeight: 38, padding: '0 18px',
          borderRadius: 999, zIndex: 1, color: T.muted,
          transition: 'color 0.2s ease',
          '&.Mui-selected': { color: '#FFFFFF' },
          // MUI bumps a tab carrying both an icon and a label to minHeight 72; hold the pill
          // height and size the glyph to sit on the label's baseline.
          '&.MuiTab-labelIcon': { minHeight: 38, paddingTop: 0, paddingBottom: 0 },
          '& .MuiTab-iconWrapper': { fontSize: 18 },
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
        tooltip: { backgroundColor: T.ink, color: T.canvas, fontSize: '0.72rem', borderRadius: 8, fontWeight: 500 },
        arrow: { color: T.ink },
      },
    },
    MuiSkeleton: {
      styleOverrides: { root: { backgroundColor: 'var(--cl-skeleton)', borderRadius: 10 } },
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
        track: { borderRadius: 22 / 2, backgroundColor: 'var(--cl-switch-track)', opacity: 1 },
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
          '&:hover': { backgroundColor: T.hover },
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
