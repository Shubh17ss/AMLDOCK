import { createTheme } from '@mui/material';

// ── Neumorphic design tokens ─────────────────────────────────────────────────
const NEU_BASE   = '#E0E5EC';
const NEU_FG     = '#3D4852';
const NEU_MUTED  = '#6B7280';
const NEU_ACCENT = '#6C63FF';
const NEU_TEAL   = '#38B2AC';

const EXT      = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_H    = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)';
const EXT_SM   = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET    = 'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)';
const INSET_D  = 'inset 10px 10px 20px rgb(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)';
const INSET_SM = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

// Legacy palette tokens — kept so components that import { palette } still compile.
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
    primary:    { main: NEU_ACCENT, dark: '#5952cc', light: '#8B84FF', contrastText: '#fff' },
    secondary:  { main: NEU_TEAL,   dark: '#2c8f8a', light: '#6fcfcb', contrastText: '#fff' },
    background: { default: NEU_BASE, paper: NEU_BASE },
    text:       { primary: NEU_FG, secondary: NEU_MUTED },
    divider:    'rgba(163,177,198,0.4)',
    error:      { main: '#EF4444', contrastText: '#fff' },
    warning:    { main: '#F59E0B', contrastText: '#fff' },
    success:    { main: NEU_TEAL,  contrastText: '#fff' },
    info:       { main: NEU_ACCENT, contrastText: '#fff' },
  },

  shape: { borderRadius: 16 },

  typography: {
    fontFamily: '"DM Sans", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    h1: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    body1: { color: NEU_FG },
    body2: { color: NEU_MUTED },
    caption: { color: NEU_MUTED },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },

  components: {
    // ── Paper / Card ──────────────────────────────────────────────────────────
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          backgroundImage: 'none',
          boxShadow: EXT,
          border: 'none',
          borderRadius: 24,
        },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'elevation' },
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          backgroundImage: 'none',
          boxShadow: EXT,
          border: 'none',
          borderRadius: 28,
          transition: 'box-shadow 0.3s ease, transform 0.3s ease',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 24, '&:last-child': { paddingBottom: 24 } },
      },
    },

    // ── App bar ───────────────────────────────────────────────────────────────
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          backgroundImage: 'none',
          boxShadow: '0 6px 16px rgb(163,177,198,0.45), 0 -1px 0 rgba(255,255,255,0.9)',
          border: 'none',
          color: NEU_FG,
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
          backgroundColor: NEU_BASE,
          backgroundImage: 'none',
          border: 'none',
          boxShadow: '6px 0 20px rgb(163,177,198,0.5), -1px 0 0 rgba(255,255,255,0.9)',
        },
      },
    },

    // ── Buttons ───────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 16,
          paddingInline: 16,
          paddingBlock: 8,
          boxShadow: EXT_SM,
          backgroundColor: NEU_BASE,
          transition: 'box-shadow 0.3s ease, transform 0.3s ease',
          '&:hover': { boxShadow: EXT_H, transform: 'translateY(-1px)', backgroundColor: NEU_BASE },
          '&:active': { boxShadow: INSET_SM, transform: 'translateY(0.5px)' },
          '&.Mui-disabled': { boxShadow: INSET_SM, color: NEU_MUTED, backgroundColor: NEU_BASE, opacity: 0.6 },
        },
        containedPrimary: {
          backgroundColor: NEU_ACCENT,
          color: '#fff',
          boxShadow: EXT_SM,
          '&:hover': { backgroundColor: '#5952cc', boxShadow: EXT_H, transform: 'translateY(-1px)' },
          '&:active': {
            backgroundColor: NEU_ACCENT,
            boxShadow: 'inset 4px 4px 8px rgba(73,65,204,0.4), inset -4px -4px 8px rgba(255,255,255,0.15)',
            transform: 'translateY(0.5px)',
          },
          '&.Mui-disabled': { backgroundColor: NEU_BASE },
        },
        containedSecondary: {
          backgroundColor: NEU_TEAL,
          color: '#fff',
          '&:hover': { backgroundColor: '#2c8f8a' },
        },
        outlined: {
          backgroundColor: NEU_BASE,
          border: 'none',
          '&:hover': { border: 'none', backgroundColor: NEU_BASE },
        },
        text: {
          boxShadow: 'none',
          backgroundColor: 'transparent',
          '&:hover': { boxShadow: 'none', backgroundColor: 'rgba(163,177,198,0.12)', transform: 'none' },
          '&:active': { boxShadow: 'none', transform: 'none' },
        },
        sizeSmall: { borderRadius: 12, paddingInline: 10, paddingBlock: 5 },
        sizeLarge: { borderRadius: 20, paddingInline: 24, paddingBlock: 12, fontSize: '1rem' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          boxShadow: EXT_SM,
          borderRadius: 12,
          transition: 'box-shadow 0.3s ease, transform 0.3s ease',
          '&:hover': { boxShadow: EXT_H, transform: 'translateY(-1px)', backgroundColor: NEU_BASE },
          '&:active': { boxShadow: INSET_SM, transform: 'translateY(0.5px)' },
        },
      },
    },

    // ── Inputs ────────────────────────────────────────────────────────────────
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          borderRadius: 16,
          boxShadow: INSET,
          transition: 'box-shadow 0.3s ease',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&.Mui-focused': {
            boxShadow: `${INSET_D}, 0 0 0 2px ${NEU_BASE}, 0 0 0 4px ${NEU_ACCENT}`,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&.Mui-error': {
            boxShadow: `${INSET}, 0 0 0 2px ${NEU_BASE}, 0 0 0 3px #EF4444`,
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { border: 'none' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: NEU_MUTED,
          '&.Mui-focused': { color: NEU_ACCENT },
          '&.Mui-error':   { color: '#EF4444' },
          // When the label shrinks/floats it sits on top of the inset
          // box-shadow "border". Give it a solid background so the shadow
          // line doesn't visually cross through the label text.
          '&.MuiInputLabel-shrink': {
            backgroundColor: NEU_BASE,
            paddingInline: '4px',
            borderRadius: '4px',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: { backgroundColor: NEU_BASE },
      },
    },

    // ── Chips ─────────────────────────────────────────────────────────────────
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999, fontSize: '0.72rem', border: 'none' },
        sizeSmall: { height: 22 },
      },
    },

    // ── Lists / Nav ───────────────────────────────────────────────────────────
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          transition: 'box-shadow 0.25s ease',
          '&:hover': { backgroundColor: NEU_BASE, boxShadow: INSET_SM },
          '&.Mui-selected': {
            backgroundColor: NEU_BASE,
            color: NEU_ACCENT,
            boxShadow: EXT_SM,
            '&:hover': { backgroundColor: NEU_BASE, boxShadow: EXT_SM },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 36 } },
    },

    // ── Tables ────────────────────────────────────────────────────────────────
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          backgroundImage: 'none',
          boxShadow: EXT,
          border: 'none',
          borderRadius: 24,
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
            backgroundColor: NEU_BASE,
            color: NEU_MUTED,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.7rem',
            borderBottom: 'none',
            boxShadow: INSET_SM,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          backgroundColor: NEU_BASE,
          borderBottom: 'none',
          color: NEU_FG,
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
          transition: 'background-color 0.2s ease',
          '&.MuiTableRow-hover:hover .MuiTableCell-root': {
            backgroundColor: 'rgba(255,255,255,0.3)',
          },
          '&:last-child .MuiTableCell-root': { borderBottom: 'none' },
        },
      },
    },

    // ── Menus ─────────────────────────────────────────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: NEU_BASE,
          backgroundImage: 'none',
          boxShadow: EXT_H,
          borderRadius: 20,
          border: 'none',
          marginTop: 8,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '2px 6px',
          transition: 'box-shadow 0.2s ease',
          '&:hover': { backgroundColor: NEU_BASE, boxShadow: INSET_SM },
          '&.Mui-selected': { backgroundColor: NEU_BASE, boxShadow: INSET_SM, color: NEU_ACCENT },
        },
      },
    },

    // ── Alerts ────────────────────────────────────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 16, border: 'none', boxShadow: INSET_SM },
        standardError:   { backgroundColor: 'rgba(239,68,68,0.08)',  color: '#b91c1c' },
        standardSuccess: { backgroundColor: 'rgba(56,178,172,0.08)',  color: '#0f766e' },
        standardInfo:    { backgroundColor: 'rgba(108,99,255,0.08)',  color: '#4338ca' },
        standardWarning: { backgroundColor: 'rgba(245,158,11,0.08)',  color: '#b45309' },
      },
    },

    // ── Tabs ─────────────────────────────────────────────────────────────────
    MuiTabs: {
      styleOverrides: {
        root: { backgroundColor: NEU_BASE, borderRadius: 999, boxShadow: INSET_SM, padding: '4px', minHeight: 40 },
        indicator: { height: '100%', borderRadius: 999, backgroundColor: NEU_BASE, boxShadow: EXT_SM, zIndex: 0 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none', fontWeight: 600, minHeight: 36,
          borderRadius: 999, zIndex: 1,
          transition: 'color 0.3s ease',
          '&.Mui-selected': { color: NEU_ACCENT },
        },
      },
    },

    // ── Misc ─────────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: { root: { borderColor: 'rgba(163,177,198,0.4)' } },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { backgroundColor: NEU_ACCENT, color: '#fff', fontWeight: 700, boxShadow: EXT_SM },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: NEU_FG, color: NEU_BASE, fontSize: '0.72rem', borderRadius: 10, boxShadow: EXT_SM },
        arrow: { color: NEU_FG },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(163,177,198,0.3)', borderRadius: 12 },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: { backgroundColor: NEU_ACCENT, color: '#fff' },
      },
    },
    MuiDialogPaper: {
      styleOverrides: {
        root: { backgroundColor: NEU_BASE, boxShadow: EXT_H, borderRadius: 28, border: 'none' },
      },
    },
  },
});

// Export legacy palette tokens for components that still import them.
export const palette = { trust, ink };
