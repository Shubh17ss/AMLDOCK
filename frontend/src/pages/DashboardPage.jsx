import { Box, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { navProfileFor, roleLabel } from '../auth/roles.js';
import { AgentDashboard } from './dashboard/AgentDashboard.jsx';
import { BranchDashboard } from './dashboard/BranchDashboard.jsx';
import { ReviewerDashboard } from './dashboard/ReviewerDashboard.jsx';
import { RootDashboard } from './dashboard/RootDashboard.jsx';
import { tokens, fonts } from '../theme/theme.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const stamp = () =>
  new Date().toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();

/** Role-aware bento dashboard. The launcher tiles are gone — each role gets a command center. */
export function DashboardPage() {
  const { user } = useAuth();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || null;

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
            {greeting()}{firstName ? `, ${firstName}` : ''}.
          </Typography>
        </Box>
      </Box>

      <Dashboard />
    </Stack>
  );
}
