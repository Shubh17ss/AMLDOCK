import { createTheme } from '@mui/material';

// Trust-blue palette (mirrors the Tailwind 'trust' scale used on the landing page so the
// brand is consistent end-to-end).
const trust = {
  50:  '#f3f7fb',
  100: '#e1ecf6',
  200: '#bfd6ea',
  300: '#94b8d8',
  400: '#5e8fbe',
  500: '#1f4b7a',
  600: '#173a61',
  700: '#102d4c',
  800: '#0a1f37',
  900: '#06152a',
};

const ink = {
  900: '#0f172a',
  700: '#334155',
  500: '#64748b',
  300: '#cbd5e1',
  200: '#e2e8f0',
  100: '#eef2f7',
  50:  '#f8fafc',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: trust[500], dark: trust[700], light: trust[400], contrastText: '#fff' },
    secondary: { main: trust[400] },
    background: { default: ink[50], paper: '#ffffff' },
    text: { primary: ink[900], secondary: ink[500] },
    divider: ink[200],
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", -apple-system, "Segoe UI", "Roboto", "Helvetica", sans-serif',
    h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    body2: { color: ink[700] },
    caption: { color: ink[500] },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: ink[200] },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: { backgroundColor: '#ffffff', borderBottom: `1px solid ${ink[200]}` },
      },
    },
    MuiToolbar: {
      styleOverrides: { root: { minHeight: 64 } },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { borderRadius: 12, border: `1px solid ${ink[200]}`, boxShadow: 'none' },
      },
    },
    MuiTable: {
      styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: ink[50],
          '& .MuiTableCell-root': {
            color: ink[500],
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: '0.72rem',
            borderBottom: `1px solid ${ink[200]}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${ink[100]}`,
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
        head: { paddingTop: 10, paddingBottom: 10 },
        sizeSmall: { padding: '10px 14px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 120ms ease',
          '&:last-child .MuiTableCell-root': { borderBottom: 'none' },
          '&.MuiTableRow-hover:hover': { backgroundColor: trust[50] },
        },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
        sizeSmall: { height: 22, fontSize: '0.72rem' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // 0.7rem (~11px) — comfortably rounded but never pill-shaped, even on small buttons.
        root: { borderRadius: '0.7rem', paddingInline: 14 },
        containedPrimary: {
          boxShadow: `0 1px 0 ${trust[700]} inset, 0 1px 2px rgba(15,42,79,0.15)`,
        },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: ink[200], borderRadius: 12 } },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: ink[200] } },
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 3, borderRadius: 2 } },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: '0.72rem', borderRadius: 6 } },
    },
  },
});

// Export tokens for the app-shell + future custom components.
export const palette = { trust, ink };
