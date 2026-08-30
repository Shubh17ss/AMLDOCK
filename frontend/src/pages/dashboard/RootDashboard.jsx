import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import InboxIcon from '@mui/icons-material/Inbox';
import { listDeals } from '../../api/deals.js';
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
  const dealsQ = useQuery({ queryKey: ['deals', 'all'], queryFn: () => listDeals() });
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const usersQ = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const auditQ = useQuery({ queryKey: ['audit', { size: 8 }], queryFn: () => searchAudit({ size: 8 }) });

  // Deliberately NOT scoped. Every other dashboard narrows to the selected branch, but this one
  // is the platform view: its hero counts "deals on the platform" and captions that with the firm
  // and user totals. Narrowing the numerator to one branch while the caption still spans every
  // entity would not be a filter, it would be a wrong number.
  const deals = dealsQ.data ?? [];

  if (dealsQ.isError) return <Alert severity="error">We couldn’t load platform data. Refresh to try again.</Alert>;
  if (dealsQ.isLoading || firmsQ.isLoading || usersQ.isLoading) return <Bento><SkeletonTiles /></Bento>;

  const firms = firmsQ.data ?? [];
  const users = usersQ.data ?? [];
  const activity = auditQ.data?.items ?? [];

  const count = (s) => deals.filter((d) => d.status === s).length;
  const segments = DEAL_STATUSES.map((s) => ({
    label: dealStatusLabel(s), value: count(s), c: dealStatusDot(s),
  }));
  const activeFirms = firms.filter((f) => f.active).length;

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="PLATFORM · LIVE"
        value={deals.length}
        label={deals.length === 1 ? 'deal on the platform' : 'deals on the platform'}
        caption={`${firms.length} reporting entities · ${users.length} users`}
        action={
          <Button component={RouterLink} to="/cdd/deals" startIcon={<InboxIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Review deals
          </Button>
        }
      />

      <StatTile index={1} eyebrow="REPORTING ENTITIES" value={firms.length} label="Registered" to="/settings/reporting-entities" />
      <StatTile index={2} eyebrow="USERS" value={users.length} label="Across all firms" to="/settings/users" />
      <DistributionTile
        index={3}
        eyebrow="DEAL STATUS · MIX"
        total={deals.length}
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
