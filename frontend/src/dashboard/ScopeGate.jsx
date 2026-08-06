import { Box, Paper, Stack, Typography } from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useDashboardScope } from './DashboardScope.jsx';
import { tokens, fonts } from '../theme/theme.js';

/**
 * The house rule: a page shows data and offers actions only once BOTH a firm and a branch are
 * picked in the sidebar Scope selector. Anything narrower than a single branch is ambiguous —
 * you can't say which register you're writing into.
 *
 * Branch-level staff have both pinned for them by ScopeSelector, so they never meet the gate;
 * ROOT and firm-level staff have to choose.
 */
export function useScopeReady(requireBranch = true) {
  const { firm, branch } = useDashboardScope();
  const missing = !firm?.id ? 'firm' : ((requireBranch && !branch?.id) ? 'branch' : null);
  return { ready: missing === null, firm, branch, missing };
}

/**
 * Renders `children` only when the scope is complete, otherwise an explanatory empty state.
 *
 * `requireBranch={false}` relaxes it to firm-only, for the rare page whose records genuinely
 * span branches — My Training, where a firm-level user's assignments can come from several.
 */
export function ScopeGate({ children, what = 'this section', requireBranch = true }) {
  const { ready, missing } = useScopeReady(requireBranch);
  if (ready) return children;

  const need = missing === 'firm'
    ? (requireBranch ? 'a reporting entity and a branch' : 'a reporting entity')
    : 'a branch';

  return (
    <Paper sx={{ p: 5, textAlign: 'center' }}>
      <Stack spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 46, height: 46, borderRadius: '14px',
            display: 'grid', placeItems: 'center',
            backgroundColor: tokens.blueWash, color: tokens.blue,
          }}
        >
          <TuneRoundedIcon />
        </Box>
        <Typography
          sx={{
            fontFamily: fonts.mono, fontSize: '0.65rem', letterSpacing: '0.13em',
            textTransform: 'uppercase', color: tokens.muted,
          }}
        >
          Scope required
        </Typography>
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: tokens.ink }}>
          Select {need} to continue
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, maxWidth: 420 }}>
          Use the <strong>Scope</strong> selector at the top of the sidebar. {what} is recorded
          per {requireBranch ? 'branch' : 'reporting entity'}, so
          {requireBranch ? ' both have' : ' it has'} to be set before anything can be shown or
          changed.
        </Typography>
      </Stack>
    </Paper>
  );
}
