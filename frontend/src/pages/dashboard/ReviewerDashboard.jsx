import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import InboxIcon from '@mui/icons-material/Inbox';
import BusinessIcon from '@mui/icons-material/Business';
import { listDeals } from '../../api/deals.js';
import { Bento, HeroTile, StatTile, ListTile, ActionTile, SkeletonTiles, STATUS_META } from '../../components/bento/Bento.jsx';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { useScopedDeals } from '../../dashboard/DashboardScope.jsx';
import { formatNZDCompact } from '../../utils/formatters.js';
import { tokens } from '../../theme/theme.js';

const sum = (deals) => deals.reduce((t, d) => t + (d.transactionValueNzd || 0), 0);

function oldestWait(deals) {
  if (!deals.length) return '—';
  const oldest = deals.reduce((min, d) => Math.min(min, new Date(d.createdAt).getTime()), Date.now());
  const hrs = (Date.now() - oldest) / 3600000;
  if (hrs < 1) return '<1h';
  if (hrs < 24) return `${Math.floor(hrs)}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function ReviewerDashboard() {
  const submittedQ = useQuery({ queryKey: ['deals', 'queue', 'SUBMITTED', null], queryFn: () => listDeals({ status: 'SUBMITTED' }) });
  const reviewQ = useQuery({ queryKey: ['deals', 'queue', 'UNDER_REVIEW', null], queryFn: () => listDeals({ status: 'UNDER_REVIEW' }) });
  const submitted = useScopedDeals(submittedQ.data);
  const underReview = useScopedDeals(reviewQ.data);

  if (submittedQ.isError) return <Alert severity="error">We couldn’t load the review queue. Refresh to try again.</Alert>;
  if (submittedQ.isLoading || reviewQ.isLoading) return <Bento><SkeletonTiles /></Bento>;
  const firmsInQueue = new Set(submitted.map((d) => d.firmName).filter(Boolean)).size;
  const awaitingItems = [...submitted, ...underReview].slice(0, 6);
  const oldest = oldestWait(submitted);
  const oldestUrgent = oldest.endsWith('d') && parseInt(oldest, 10) >= 3;

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="DEALS · LIVE"
        value={submitted.length}
        label={submitted.length === 1 ? 'deal awaiting review' : 'deals awaiting review'}
        caption={`${underReview.length} under way · ${formatNZDCompact(sum(submitted))} awaiting clearance`}
        action={
          <Button component={RouterLink} to="/cdd/deals" startIcon={<InboxIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Open deals
          </Button>
        }
      />

      <StatTile index={1} eyebrow="AWAITING" dot={STATUS_META.SUBMITTED.c} value={submitted.length}
                label="To be claimed" to="/cdd/deals" />
      <StatTile index={2} eyebrow="UNDER REVIEW" dot={STATUS_META.UNDER_REVIEW.c} value={underReview.length}
                label="In progress" color={underReview.length ? tokens.review : undefined} to="/cdd/deals" />
      <StatTile index={3} eyebrow="NZD · AWAITING" cols={2} mono value={formatNZDCompact(sum(submitted))}
                label="Transaction value in the queue" />

      <ListTile
        index={4}
        eyebrow="AWAITING · YOUR REVIEW"
        title="Next deals to review"
        to="/cdd/deals"
        items={awaitingItems}
        renderItem={(d) => <DealRow deal={d} to={d.status === 'UNDER_REVIEW' ? `/deals/${d.id}/review` : `/deals/${d.id}`} />}
        empty="Nothing awaiting review."
      />

      <StatTile index={5} eyebrow="OLDEST WAIT" mono value={oldest}
                label="Longest awaiting review" color={oldestUrgent ? tokens.rejected : undefined} to="/cdd/deals" />
      <StatTile index={6} eyebrow="ENTITIES" value={firmsInQueue} label="With deals waiting" to="/cdd/deals" />

      <ActionTile
        index={7}
        actions={[
          { to: '/cdd/deals', label: 'Review deals', icon: <InboxIcon fontSize="small" />, primary: true },
          { to: '/my-firm', label: 'Your firm', icon: <BusinessIcon fontSize="small" /> },
        ]}
      />
    </Bento>
  );
}
