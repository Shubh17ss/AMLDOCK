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
  Bento, HeroTile, StatTile, ListTile, ActionTile, DistributionTile, SkeletonTiles, STATUS_META,
} from '../../components/bento/Bento.jsx';
import { timeAgo } from '../../utils/formatters.js';
import { tokens, fonts } from '../../theme/theme.js';

export function RootDashboard() {
  const dealsQ = useQuery({ queryKey: ['deals', 'all'], queryFn: () => listDeals() });
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const usersQ = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const auditQ = useQuery({ queryKey: ['audit', { size: 8 }], queryFn: () => searchAudit({ size: 8 }) });

  if (dealsQ.isError) return <Alert severity="error">We couldn’t load platform data. Refresh to try again.</Alert>;
  if (dealsQ.isLoading || firmsQ.isLoading || usersQ.isLoading) return <Bento><SkeletonTiles /></Bento>;

  const deals = dealsQ.data ?? [];
  const firms = firmsQ.data ?? [];
  const users = usersQ.data ?? [];
  const activity = auditQ.data?.items ?? [];

  const count = (s) => deals.filter((d) => d.status === s).length;
  const segments = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((s) => ({
    label: STATUS_META[s].label, value: count(s), c: STATUS_META[s].c,
  }));
  const activeFirms = firms.filter((f) => f.active).length;

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="PLATFORM · LIVE"
        value={deals.length}
        label={deals.length === 1 ? 'deal on the platform' : 'deals on the platform'}
        caption={`${firms.length} firms · ${users.length} users`}
        action={
          <Button component={RouterLink} to="/queue" startIcon={<InboxIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Review queue
          </Button>
        }
      />

      <StatTile index={1} eyebrow="FIRMS" value={firms.length} label="Registered" to="/admin/firms" />
      <StatTile index={2} eyebrow="USERS" value={users.length} label="Across all firms" to="/admin/users" />
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
        to="/admin/audit"
        items={activity}
        renderItem={(a) => <AuditRow entry={a} />}
        empty={auditQ.isError ? 'Activity feed unavailable.' : 'No recent activity.'}
      />

      <StatTile index={5} eyebrow="ACTIVE FIRMS" dot={tokens.approved} value={activeFirms}
                label={`${firms.length - activeFirms} inactive`} to="/admin/firms" />
      <StatTile index={6} eyebrow="AWAITING" dot={STATUS_META.SUBMITTED.c} value={count('SUBMITTED')}
                label="In the queue" color={count('SUBMITTED') ? tokens.submitted : undefined} to="/queue" />

      <ActionTile
        index={7}
        actions={[
          { to: '/admin/firms', label: 'Firms', icon: <BusinessIcon fontSize="small" />, primary: true },
          { to: '/admin/users', label: 'Users', icon: <PeopleIcon fontSize="small" /> },
          { to: '/admin/audit', label: 'Audit log', icon: <HistoryIcon fontSize="small" /> },
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
