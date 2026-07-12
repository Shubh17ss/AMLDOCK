import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PeopleIcon from '@mui/icons-material/People';
import { listDeals } from '../../api/deals.js';
import { listUsers } from '../../api/users.js';
import {
  Bento, HeroTile, StatTile, ListTile, ActionTile, BentoTile, Eyebrow, SkeletonTiles, STATUS_META,
} from '../../components/bento/Bento.jsx';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { useScopedDeals } from '../../dashboard/DashboardScope.jsx';
import { roleLabel } from '../../auth/roles.js';
import { formatNZDCompact } from '../../utils/formatters.js';
import { tokens, fonts } from '../../theme/theme.js';

const byUpdated = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
const sum = (deals) => deals.reduce((t, d) => t + (d.transactionValueNzd || 0), 0);
const withinDays = (iso, days) => iso && (Date.now() - new Date(iso)) / 86400000 <= days;

export function BranchDashboard() {
  const dealsQ = useQuery({ queryKey: ['deals', 'firm', 'ALL'], queryFn: () => listDeals() });
  const usersQ = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const deals = useScopedDeals(dealsQ.data);

  if (dealsQ.isError) return <Alert severity="error">We couldn’t load your branch. Refresh to try again.</Alert>;
  if (dealsQ.isLoading) return <Bento><SkeletonTiles /></Bento>;
  const users = usersQ.data ?? [];
  const submitted = deals.filter((d) => d.status === 'SUBMITTED');
  const underReview = deals.filter((d) => d.status === 'UNDER_REVIEW');
  const approvedRecent = deals.filter((d) => d.status === 'APPROVED' && withinDays(d.updatedAt, 30));
  const inMotion = submitted.length + underReview.length;
  const activeUsers = users.filter((u) => u.active);
  const recent = [...deals].sort(byUpdated).slice(0, 5);

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
        caption={`${formatNZDCompact(sum([...submitted, ...underReview]))} moving through review`}
        action={
          <Box component={RouterLink} to="/firm/deals"
               sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: '#fff', color: tokens.blue,
                     fontWeight: 700, fontSize: '0.85rem', borderRadius: '12px', px: 2, py: 1, textDecoration: 'none' }}>
            Open branch deals →
          </Box>
        }
      />

      <StatTile index={1} eyebrow="BRANCH DEALS" value={deals.length} label="All-time" to="/firm/deals" />
      <StatTile index={2} eyebrow="TEAM" dot={tokens.blue} value={activeUsers.length} label="Active users" to="/branch-users" />
      <StatTile index={3} eyebrow="SUBMITTED" cols={2} dot={STATUS_META.SUBMITTED.c} value={submitted.length}
                label="Waiting for a reviewer to claim" color={submitted.length ? tokens.submitted : undefined} to="/firm/deals" />

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
              px: 1.25, py: 0.6, borderRadius: '9px', backgroundColor: '#F2F5FA' }}>
              <Typography sx={{ fontFamily: fonts.mono, fontWeight: 700, color: tokens.ink, fontSize: '0.9rem' }}>{n}</Typography>
              <Typography sx={{ fontSize: '0.74rem', color: tokens.muted }}>{roleLabel(role)}</Typography>
            </Box>
          )) : <Typography sx={{ fontSize: '0.82rem', color: tokens.muted }}>No team members yet.</Typography>}
        </Box>
      </BentoTile>

      <StatTile index={6} eyebrow="IN REVIEW" dot={STATUS_META.UNDER_REVIEW.c} value={underReview.length}
                label="Under compliance" color={underReview.length ? tokens.review : undefined} to="/firm/deals" />
      <StatTile index={7} eyebrow="APPROVED · 30D" dot={STATUS_META.APPROVED.c} value={approvedRecent.length}
                label="Cleared this month" color={approvedRecent.length ? tokens.approved : undefined} to="/firm/deals" />

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
