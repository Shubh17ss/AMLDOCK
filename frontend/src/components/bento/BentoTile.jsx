import { Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens, shadows, fonts } from '../../theme/theme.js';

/**
 * One bento cell. Spans `cols` × `rows` of the parent grid, fades+rises on load
 * (staggered by `index`, disabled under prefers-reduced-motion), and lifts on hover
 * when interactive. Variants: 'plain' (white), 'accent' (blue), 'ink' (near-black).
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
    // Frosted glass over the ambient canvas wash — the premium surface.
    plain: {
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(14px) saturate(160%)',
      WebkitBackdropFilter: 'blur(14px) saturate(160%)',
      color: tokens.ink,
      border: `1px solid ${tokens.hairline}`,
    },
    accent: {
      background: `linear-gradient(140deg, ${tokens.blue} 0%, ${tokens.blueDark} 100%)`,
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
        boxShadow: variant === 'plain' ? shadows.md : shadows.lg,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        textDecoration: 'none',
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease',
        // orchestrated page-load
        opacity: 0,
        animation: 'bentoRise 0.5s cubic-bezier(0.22,1,0.36,1) forwards',
        animationDelay: `${Math.min(index, 12) * 55}ms`,
        '@keyframes bentoRise': {
          from: { opacity: 0, transform: 'translateY(14px) scale(0.985)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        ...(interactive && {
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: variant === 'plain' ? shadows.lg : shadows.lg,
            borderColor: variant === 'plain' ? tokens.hairline2 : 'transparent',
          },
        }),
        '&.Mui-focusVisible, &:focus-visible': { outline: 'none', boxShadow: shadows.focus },
        '@media (prefers-reduced-motion: reduce)': {
          opacity: 1,
          animation: 'none',
          '&:hover': { transform: 'none' },
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The signature device: a monospace, letterspaced "ledger" label that encodes real
 * meta (status, sequence, units). Optional leading status dot.
 */
export function Eyebrow({ children, dot, muted, light }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        fontFamily: fonts.mono,
        fontSize: '0.66rem',
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: light ? 'rgba(255,255,255,0.78)' : (muted ? tokens.muted : tokens.muted),
        lineHeight: 1,
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
