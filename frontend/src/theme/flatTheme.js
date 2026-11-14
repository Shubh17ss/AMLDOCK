import { createTheme } from '@mui/material';
import { theme, tokens, fonts, shadows } from './theme.js';

const T = tokens;

/**
 * The flat variant of the workspace theme — the public site's language applied to MUI.
 *
 * Same palette, tokens and fonts as `theme`; what changes is the treatment. Surfaces sit on a
 * hairline with no shadow, headings drop to medium weight, buttons and chips are fully rounded,
 * and table headings are sentence case rather than letterspaced capitals. Elevation is left only
 * on what actually floats: dialogs, menus and popovers keep theirs.
 *
 * Applied per route through FlatSurface, so a section can move to this look without the rest of
 * the workspace changing under it. Once every section is on it, these overrides belong in
 * theme.js and this file goes.
 */
export const flatTheme = createTheme(theme, {
  typography: {
    h4: { fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.03em' },
    h5: { fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.025em' },
    h6: { fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.02em' },
  },

  components: {
    // Paper is also what menus, popovers and dialogs are made of, and those keep their shadow —
    // so only the in-page kinds are flattened here, by their own class.
    MuiPaper: {
      styleOverrides: {
        root: {
          '&.MuiTableContainer-root, &.MuiCard-root, &.MuiPaper-outlined': {
            boxShadow: 'none',
            borderColor: T.hairline2,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: { root: { boxShadow: 'none', borderColor: T.hairline2 } },
    },
    MuiTableContainer: {
      styleOverrides: { root: { boxShadow: 'none', borderColor: T.hairline2 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: 'transparent',
            color: T.muted,
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: 0,
            fontSize: '0.8rem',
            borderBottom: `1px solid ${T.hairline2}`,
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 18 },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': { backgroundColor: T.blueDark, boxShadow: 'none' },
        },
        outlinedPrimary: {
          '&:hover': { borderColor: T.ink, backgroundColor: T.tile },
        },
        sizeSmall: { borderRadius: 999, paddingInline: 14 },
        sizeLarge: { borderRadius: 999 },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 999 } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600, fontSize: '0.74rem', letterSpacing: 0 },
        sizeSmall: { height: 24 },
      },
    },

    MuiDialog: {
      styleOverrides: { paper: { boxShadow: shadows.lg } },
    },
  },
});
