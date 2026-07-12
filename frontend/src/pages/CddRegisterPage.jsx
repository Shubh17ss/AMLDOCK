import { Box, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { navProfileFor, roleLabel } from '../auth/roles.js';
import { AgentDashboard } from './dashboard/AgentDashboard.jsx';
import { BranchDashboard } from './dashboard/BranchDashboard.jsx';
import { ReviewerDashboard } from './dashboard/ReviewerDashboard.jsx';
import { RootDashboard } from './dashboard/RootDashboard.jsx';
import { ScopeSelector } from '../components/dashboard/ScopeSelector.jsx';
import { stamp } from './dashboard/greeting.js';
import { tokens, fonts } from '../theme/theme.js';

/** CDD Register — the role-aware stats command centre (formerly the default dashboard). */
export function CddRegisterPage() {
  const { user } = useAuth();

  const Dashboard = {
    agent: AgentDashboard,
    salesManager: BranchDashboard,
    firmReviewer: ReviewerDashboard,
    root: RootDashboard,
  }[navProfileFor(user?.role)] ?? AgentDashboard;

  return (
    <Stack spacing={{ xs: 2.5, md: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{
            fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.16em',
            color: tokens.muted, textTransform: 'uppercase', mb: 0.75,
          }}>
            {stamp()} . {roleLabel(user?.role)}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: tokens.ink }}>
            CDD Register
          </Typography>
        </Box>
        {/* Mobile only — on desktop the scope selector lives in the sidebar. */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <ScopeSelector />
        </Box>
      </Box>

      <Dashboard />
    </Stack>
  );
}
