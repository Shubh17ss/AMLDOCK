import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PeopleIcon from '@mui/icons-material/People';
import { listUsers } from '../../api/users.js';
import {
  Bento, HeroTile, StatTile, ListTile, ActionTile, BentoTile, Eyebrow, SkeletonTiles,
} from '../../components/bento/Bento.jsx';
import { dealStatusDot } from '../../data/dealStatus.js';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { countOf, recentOf, useDealSample, useDealSummary, valueOf } from '../../dashboard/dealSummary.js';
import { roleLabel } from '../../auth/roles.js';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { tokens, fonts } from '../../theme/theme.js';

// Deal worth is a min-max range, so totals take the upper bound — the conservative read
// for AML value thresholds. Pre-V28 deals only have the single transactionValue. The server
// computes it (valueOf) over every deal in scope.

export function BranchDashboard() {
  const dealsQ = useDealSummary();
  const recentQ = useDealSample({ size: 5, sort: 'updatedAt' });
  const usersQ = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const money = useCurrency();

  if (dealsQ.isError) return <Alert severity="error">We couldn’t load your branch. Refresh to try again.</Alert>;
  if (dealsQ.isLoading) return <Bento><SkeletonTiles /></Bento>;
  const users = usersQ.data ?? [];
  const summary = dealsQ.data;
  const underReview = countOf(summary, 'REVIEW');
  const onHold = countOf(summary, 'ON_HOLD');
  const verifiedRecent = recentOf(summary, 'VERIFIED');
  // Everything sitting with compliance, decided or not - a parked deal is still in motion,
  // because somebody still has to move it.
  const inMotion = underReview + onHold;
  const activeUsers = users.filter((u) => u.active);
  const recent = recentQ.data ?? [];

  // team headcount by role
  const teamByRole = activeUsers.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const teamRows = Object.entries(teamByRole).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="BRANCH · LIVE"
        value={inMotion}
        label={inMotion === 1 ? 'deal in motion' : 'deals in motion'}
        caption={`${money.formatCompact(valueOf(summary, 'REVIEW', 'ON_HOLD'))} moving through review`}
        action={
          <Box component={RouterLink} to="/firm/deals"
               sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: '#fff', color: tokens.blue,
                     fontWeight: 700, fontSize: '0.85rem', borderRadius: '12px', px: 2, py: 1, textDecoration: 'none' }}>
            Open branch deals →
          </Box>
        }
      />

      <StatTile index={1} eyebrow="BRANCH DEALS" value={summary.total} label="All-time" to="/firm/deals" />
      <StatTile index={2} eyebrow="TEAM" dot={tokens.blue} value={activeUsers.length} label="Active users" to="/branch-users" />
      <StatTile index={3} eyebrow="IN REVIEW" cols={2} dot={dealStatusDot('REVIEW')} value={underReview}
                label="With compliance" color={underReview ? tokens.review : undefined} to="/firm/deals" />

      <ListTile
        index={4}
        eyebrow="RECENT · UPDATED"
        title="Recent branch deals"
        to="/firm/deals"
        items={recent}
        renderItem={(d) => <DealRow deal={d} to={`/firm/deals/${d.id}`} />}
        empty="No deals in your branch yet."
      />

      {/* Branch team breakdown */}
      <BentoTile index={5} cols={2} rows={1}>
        <Eyebrow>BRANCH TEAM</Eyebrow>
        <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {teamRows.length ? teamRows.map(([role, n]) => (
            <Box key={role} sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.6,
              px: 1.25, py: 0.6, borderRadius: '9px', backgroundColor: tokens.hover }}>
              <Typography sx={{ fontFamily: fonts.mono, fontWeight: 700, color: tokens.ink, fontSize: '0.9rem' }}>{n}</Typography>
              <Typography sx={{ fontSize: '0.74rem', color: tokens.muted }}>{roleLabel(role)}</Typography>
            </Box>
          )) : <Typography sx={{ fontSize: '0.82rem', color: tokens.muted }}>No team members yet.</Typography>}
        </Box>
      </BentoTile>

      <StatTile index={6} eyebrow="IN REVIEW" dot={dealStatusDot('REVIEW')} value={underReview}
                label="Under compliance" color={underReview ? tokens.review : undefined} to="/firm/deals" />
      <StatTile index={7} eyebrow="VERIFIED · 30D" dot={dealStatusDot('VERIFIED')} value={verifiedRecent}
                label="Cleared this month" color={verifiedRecent ? tokens.approved : undefined} to="/firm/deals" />

      <ActionTile
        index={8}
        cols={4}
        actions={[
          { to: '/firm/deals', label: 'Branch deals', icon: <BusinessCenterIcon fontSize="small" />, primary: true },
          { to: '/branch-users', label: 'Manage users', icon: <PeopleIcon fontSize="small" /> },
        ]}
      />
    </Bento>
  );
}
