import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import InboxIcon from '@mui/icons-material/Inbox';
import { countOf, useDealSummary } from '../../dashboard/dealSummary.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { listFirms } from '../../api/firms.js';
import { listUsers } from '../../api/users.js';
import { searchAudit } from '../../api/audit.js';
import {
  Bento, HeroTile, StatTile, ListTile, ActionTile, DistributionTile, SkeletonTiles,
} from '../../components/bento/Bento.jsx';
import { DEAL_STATUSES, dealStatusDot, dealStatusLabel } from '../../data/dealStatus.js';
import { timeAgo } from '../../utils/formatters.js';
import { tokens, fonts } from '../../theme/theme.js';

export function RootDashboard() {
  // Follows the scope picker like every other dashboard: the deal figures (hero, status mix, in
  // review) are the selected branch's, and the user count is the selected entity's — entity-wide
  // rather than branch-wide, since compliance officers and senior managers belong to no branch and
  // would drop out of a branch count. The entity register tiles and the activity feed stay
  // platform-wide: they describe the platform itself, and the audit log has no entity filter.
  const { firm, branch } = useDashboardScope();
  const firmId = firm?.id ?? null;
  const dealsQ = useDealSummary();
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const usersQ = useQuery({
    queryKey: ['users', { firmId }],
    queryFn: () => listUsers({ firmId }),
    enabled: Boolean(firmId),
  });
  const auditQ = useQuery({ queryKey: ['audit', { size: 8 }], queryFn: () => searchAudit({ size: 8 }) });

  const summary = dealsQ.data;

  if (dealsQ.isError) return <Alert severity="error">We couldn’t load platform data. Refresh to try again.</Alert>;
  if (dealsQ.isLoading || firmsQ.isLoading || (firmId && usersQ.isLoading)) return <Bento><SkeletonTiles /></Bento>;

  const firms = firmsQ.data ?? [];
  // The server's entity filter keeps platform accounts (ROOT, AUDIT) that belong to no entity, as
  // the overseers of every one; this tile counts the entity's own people only.
  const users = (usersQ.data ?? []).filter((u) => u.realEstateFirmId === firmId);
  const activity = auditQ.data?.items ?? [];

  const count = (s) => countOf(summary, s);
  const total = summary?.total ?? 0;
  const segments = DEAL_STATUSES.map((s) => ({
    label: dealStatusLabel(s), value: count(s), c: dealStatusDot(s),
  }));
  const activeFirms = firms.filter((f) => f.active).length;

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow={`${(firm?.name ?? 'Platform').toUpperCase()} · LIVE`}
        value={total}
        label={`${total === 1 ? 'deal' : 'deals'} in ${branch?.name ?? 'this branch'}`}
        caption={[firm?.name, branch?.name].filter(Boolean).join(' · ')}
        action={
          <Button component={RouterLink} to="/cdd/deals" startIcon={<InboxIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Review deals
          </Button>
        }
      />

      <StatTile index={1} eyebrow="REPORTING ENTITIES" value={firms.length} label="Registered" to="/settings/reporting-entities" />
      <StatTile index={2} eyebrow="USERS" value={users.length} label={`In ${firm?.name ?? 'this entity'}`} to="/settings/users" />
      <DistributionTile
        index={3}
        eyebrow="DEAL STATUS · MIX"
        total={total}
        segments={segments}
        cols={2}
      />

      <ListTile
        index={4}
        eyebrow="ACTIVITY · RECENT"
        title="Across the platform"
        to="/settings/audit-log"
        items={activity}
        renderItem={(a) => <AuditRow entry={a} />}
        empty={auditQ.isError ? 'Activity feed unavailable.' : 'No recent activity.'}
      />

      <StatTile index={5} eyebrow="ACTIVE ENTITIES" dot={tokens.approved} value={activeFirms}
                label={`${firms.length - activeFirms} inactive`} to="/settings/reporting-entities" />
      <StatTile index={6} eyebrow="IN REVIEW" dot={dealStatusDot('REVIEW')} value={count('REVIEW')}
                label="With compliance" color={count('REVIEW') ? tokens.review : undefined} to="/cdd/deals" />

      <ActionTile
        index={7}
        actions={[
          { to: '/settings/reporting-entities', label: 'Reporting entities', icon: <BusinessIcon fontSize="small" />, primary: true },
          { to: '/settings/users', label: 'Users', icon: <PeopleIcon fontSize="small" /> },
          { to: '/settings/audit-log', label: 'Audit log', icon: <HistoryIcon fontSize="small" /> },
        ]}
      />
    </Bento>
  );
}

function AuditRow({ entry }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25, py: 0.9, px: 0.5,
      borderBottom: `1px solid ${tokens.hairline}`, '&:last-child': { borderBottom: 'none' },
    }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.66rem', color: tokens.muted, letterSpacing: '0.04em' }}>
          {entry.action}
        </Typography>
        <Typography noWrap sx={{ fontSize: '0.84rem', color: tokens.ink }}>
          {entry.summary || entry.actorEmail || '—'}
        </Typography>
      </Box>
      <Typography sx={{ flexShrink: 0, fontSize: '0.72rem', color: tokens.muted }}>
        {timeAgo(entry.createdAt)}
      </Typography>
    </Box>
  );
}
