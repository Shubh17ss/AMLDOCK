import { Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens, shadows } from '../../theme/theme.js';

/**
 * One bento cell. Spans `cols` × `rows` of the parent grid, fades+rises on load
 * (staggered by `index`, disabled under prefers-reduced-motion). Variants: 'plain' (white on a
 * hairline), 'accent' (blue), 'ink' (near-black).
 *
 * Flat: no glass, no shadow, no sheen. An interactive tile says so by darkening its edge on
 * hover, not by lifting — elevation is kept for things that float over the page.
 */
export function BentoTile({
  cols = 1,
  rows = 1,
  index = 0,
  variant = 'plain',
  to,
  onClick,
  ariaLabel,
  children,
  sx,
}) {
  const interactive = Boolean(to || onClick);

  const surface = {
    plain: {
      background: tokens.tile,
      color: tokens.ink,
      border: `1px solid ${tokens.hairline2}`,
    },
    accent: {
      background: tokens.blue,
      color: '#fff',
      border: '1px solid transparent',
    },
    ink: { background: tokens.ink, color: '#fff', border: '1px solid transparent' },
  }[variant];

  const keyboard = onClick && !to
    ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
        },
      }
    : {};

  return (
    <Box
      component={to ? RouterLink : 'div'}
      to={to}
      onClick={onClick}
      aria-label={ariaLabel}
      {...keyboard}
      sx={{
        // grid placement — clamp to 2 cols on the narrow (2-col) breakpoint
        gridColumn: { xs: `span ${Math.min(cols, 2)}`, md: `span ${cols}` },
        gridRow: `span ${rows}`,
        // surface
        ...surface,
        borderRadius: '20px',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        textDecoration: 'none',
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        // orchestrated page-load: rise and settle
        opacity: 0,
        animation: 'bentoRise 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        animationDelay: `${Math.min(index, 12) * 55}ms`,
        '@keyframes bentoRise': {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        ...(interactive && variant === 'plain' && {
          '&:hover': { borderColor: tokens.ink },
        }),
        '&.Mui-focusVisible, &:focus-visible': { outline: 'none', boxShadow: shadows.focus },
        '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * A small caption over a figure or a list: what the number is, or which list this is.
 * Sentence case, body face. Optional leading status dot.
 */
export function Eyebrow({ children, dot, light }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: '0.8rem',
        fontWeight: 500,
        color: light ? 'rgba(255,255,255,0.8)' : tokens.muted,
        lineHeight: 1.2,
      }}
    >
      {dot && (
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
      )}
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </Box>
    </Box>
  );
}
