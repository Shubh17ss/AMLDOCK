import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ScopeSelector } from '../../components/dashboard/ScopeSelector.jsx';
import { tokens, fonts, shadows, motion } from '../../theme/theme.js';

/**
 * The broker's home screen on a phone.
 *
 * <p>Replaces the module-group carousel, which is a compliance officer's index of registers rather
 * than an agent's work. What is left is the three things an agent opens the app to do, in the order
 * they do them, over the one piece of state everything else is written into: the scope.
 *
 * <p>Purely presentational — it fires no queries. The scope selects are the app's existing
 * component; for branch-level staff both are pinned from their own record and render read-only,
 * which is the honest display: it says where you are working rather than offering a choice that
 * isn't theirs.
 */
export function BrokerMobileHome() {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          p: 1.75,
          borderRadius: '20px',
          backgroundColor: tokens.tile,
          border: `1px solid ${tokens.hairline}`,
          boxShadow: shadows.sm,
        }}
      >
        <Typography
          sx={{
            fontFamily: fonts.mono, fontSize: '0.62rem', fontWeight: 500,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: tokens.muted, mb: 1.25, px: 0.25,
          }}
        >
          Working in
        </Typography>
        <ScopeSelector stacked />
      </Box>

      <Stack spacing={1.25}>
        <ActionRow to="/deals/new" label="Create deal" primary icon={<PlusGlyph />} />
        <ActionRow to="/my-deals" label="My deals" icon={<DealsGlyph />} />
        <ActionRow to="/my-training" label="My learnings" icon={<LearningGlyph />} />
      </Stack>
    </Stack>
  );
}

/**
 * One tap target. The primary carries the blue and no chevron — it starts something rather than
 * going somewhere; the other two are navigation and say so with the trailing mark.
 */
function ActionRow({ to, label, icon, primary = false }) {
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={motion.respectful({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 60,
        px: 2,
        borderRadius: '18px',
        textDecoration: 'none',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        backgroundColor: primary ? tokens.blue : tokens.tile,
        border: `1px solid ${primary ? 'transparent' : tokens.hairline}`,
        boxShadow: primary ? '0 6px 18px -8px rgba(27,95,227,0.7)' : shadows.sm,
        color: primary ? '#fff' : tokens.ink,
        transition: `transform ${motion.swift} ease, box-shadow ${motion.swift} ease`,
        '&:active': { transform: 'scale(0.99)' },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
      })}
    >
      <Box
        sx={{
          width: 34, height: 34, borderRadius: '11px', flexShrink: 0,
          display: 'grid', placeItems: 'center',
          backgroundColor: primary ? 'rgba(255,255,255,0.18)' : tokens.blueWash,
          color: primary ? '#fff' : tokens.blue,
        }}
      >
        {icon}
      </Box>

      <Typography
        sx={{
          flexGrow: 1, minWidth: 0,
          fontFamily: fonts.display,
          fontSize: '1rem',
          fontWeight: primary ? 700 : 600,
          letterSpacing: '-0.01em',
          color: 'inherit',
        }}
      >
        {label}
      </Typography>

      {!primary && (
        <Box aria-hidden sx={{ color: tokens.muted, display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Box>
      )}
    </Box>
  );
}

function PlusGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function DealsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="12" height="15" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 9h6M8 12h6M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="7" y="2" width="10" height="3" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function LearningGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 7.5C10.5 6 8.5 5.25 5 5.25A1 1 0 004 6.25v11a1 1 0 001 1c3.5 0 5.5.75 7 2.25 1.5-1.5 3.5-2.25 7-2.25a1 1 0 001-1v-11a1 1 0 00-1-1c-3.5 0-5.5.75-7 2.25z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
      />
      <path d="M12 7.5v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
