import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens, shadows, fonts } from '../theme/theme.js';
import { SiteLayout } from '../site/SiteLayout.jsx';
import { Button as SiteButton } from '../site/ui/Button.jsx';

/**
 * The not-found view. Full screen for an unknown route; `embedded` renders it inside the app
 * shell, for a record that is missing or that the viewer may not see.
 */
export function NotFoundPage({
  embedded = false,
  title = 'Page not found',
  message = 'This page doesn\u2019t exist or was moved.',
}) {
  if (!embedded) return <FullScreenNotFound title={title} message={message} />;

  return (
    <Box sx={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: 420,
      py: 6,
    }}>
      <Stack spacing={3} alignItems="center">
        {/* Big clearance numeral */}
        <Box sx={{
          width: 150, height: 150, borderRadius: '50%',
          backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`, boxShadow: shadows.md,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{
            fontFamily: fonts.display,
            fontWeight: 800, fontSize: '3rem', color: tokens.blue, letterSpacing: '-0.03em',
          }}>
            404
          </Typography>
        </Box>

        <Stack spacing={0.75} alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.ink }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, textAlign: 'center' }}>
            {message}
          </Typography>
        </Stack>

        <Button component={RouterLink} to="/" variant="contained" size="large">
          Go home
        </Button>
      </Stack>
    </Box>
  );
}

/** An unknown address, outside the app shell: dressed as the public site. */
function FullScreenNotFound({ title, message }) {
  return (
    <SiteLayout>
      <section className="site-404">
        <div className="site-plan" aria-hidden="true" />
        <div className="site-wrap" style={{ position: 'relative', display: 'grid', gap: 20 }}>
          <p className="site-404__num" aria-hidden="true">404</p>
          <h1 className="site-h1">{title}</h1>
          <p className="site-lead">{message}</p>
          <div><SiteButton to="/">Go to the home page</SiteButton></div>
        </div>
      </section>
    </SiteLayout>
  );
}
