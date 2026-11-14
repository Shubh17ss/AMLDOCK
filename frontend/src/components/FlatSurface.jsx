import { Box, ThemeProvider } from '@mui/material';
import { flatTheme } from '../theme/flatTheme.js';
import { fonts } from '../theme/theme.js';

/**
 * Renders a page in the flat theme (theme/flatTheme.js).
 *
 * Wrapped around a route's element in AppRoutes. Everything under it, including the dialogs and
 * menus it opens — portals leave the DOM subtree but not the React one — picks up the flat
 * treatment with no change to the page itself.
 *
 * The one thing a theme cannot reach is PageHeader's title, which states its own weight in `sx`.
 * The descendant rule here outranks it, so the shared header stays untouched for every page that
 * is not on this surface yet.
 */
export function FlatSurface({ children }) {
  return (
    <ThemeProvider theme={flatTheme}>
      <Box sx={{
        '& .MuiTypography-h4': {
          fontFamily: fonts.display, fontWeight: 500, letterSpacing: '-0.035em',
          fontSize: 'clamp(1.8rem, 3vw, 2.3rem)', lineHeight: 1.1,
        },
      }}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
