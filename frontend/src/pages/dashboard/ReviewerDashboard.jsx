import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import InboxIcon from '@mui/icons-material/Inbox';
import BusinessIcon from '@mui/icons-material/Business';
import { listDeals } from '../../api/deals.js';
import { Bento, HeroTile, StatTile, ListTile, ActionTile, SkeletonTiles } from '../../components/bento/Bento.jsx';
import { dealStatusDot, isReviewable } from '../../data/dealStatus.js';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { useScopedDeals } from '../../dashboard/DashboardScope.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { tokens } from '../../theme/theme.js';

// Deal worth is a min-max range, so totals take the upper bound — the conservative read
// for AML value thresholds. Pre-V28 deals only have the single transactionValue.
const sum = (deals) => deals.reduce((t, d) => t + (d.valuationMax ?? d.transactionValue ?? 0), 0);

function oldestWait(deals) {
  if (!deals.length) return '—';
  const oldest = deals.reduce((min, d) => Math.min(min, new Date(d.createdAt).getTime()), Date.now());
  const hrs = (Date.now() - oldest) / 3600000;
  if (hrs < 1) return '<1h';
  if (hrs < 24) return `${Math.floor(hrs)}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function ReviewerDashboard() {
  const reviewQ = useQuery({ queryKey: ['deals', 'queue', 'REVIEW', null], queryFn: () => listDeals({ status: 'REVIEW' }) });
  // On hold is a queue somebody has to clear, which the old REJECTED never was — a parked deal
  // needs a person to either resolve it or send it back.
  const holdQ = useQuery({ queryKey: ['deals', 'queue', 'ON_HOLD', null], queryFn: () => listDeals({ status: 'ON_HOLD' }) });
  const underReview = useScopedDeals(reviewQ.data);
  const onHold = useScopedDeals(holdQ.data);
  const money = useCurrency();

  if (reviewQ.isError) return <Alert severity="error">We couldn’t load the review queue. Refresh to try again.</Alert>;
  if (reviewQ.isLoading || holdQ.isLoading) return <Bento><SkeletonTiles /></Bento>;
  const firmsInQueue = new Set(underReview.map((d) => d.firmName).filter(Boolean)).size;
  const awaitingItems = [...underReview, ...onHold].slice(0, 6);
  const oldest = oldestWait(underReview);
  const oldestUrgent = oldest.endsWith('d') && parseInt(oldest, 10) >= 3;

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="DEALS · LIVE"
        value={underReview.length}
        label={underReview.length === 1 ? 'deal in review' : 'deals in review'}
        caption={`${onHold.length} on hold · ${money.formatCompact(sum(underReview))} awaiting clearance`}
        action={
          <Button component={RouterLink} to="/cdd/deals" startIcon={<InboxIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Open deals
          </Button>
        }
      />

      <StatTile index={1} eyebrow="IN REVIEW" dot={dealStatusDot('REVIEW')} value={underReview.length}
                label="With compliance" color={underReview.length ? tokens.review : undefined} to="/cdd/deals" />
      <StatTile index={2} eyebrow="ON HOLD" dot={dealStatusDot('ON_HOLD')} value={onHold.length}
                label="Parked, needing a decision" color={onHold.length ? tokens.rejected : undefined} to="/cdd/deals" />
      <StatTile index={3} eyebrow={`${money.code} · AWAITING`} cols={2} mono value={money.formatCompact(sum(underReview))}
                label="Transaction value in the queue" />

      <ListTile
        index={4}
        eyebrow="AWAITING · YOUR REVIEW"
        title="Next deals to review"
        to="/cdd/deals"
        items={awaitingItems}
        renderItem={(d) => <DealRow deal={d} to={isReviewable(d.status) ? `/deals/${d.id}/review` : `/deals/${d.id}`} />}
        empty="Nothing awaiting review."
      />

      <StatTile index={5} eyebrow="OLDEST WAIT" mono value={oldest}
                label="Longest awaiting review" color={oldestUrgent ? tokens.rejected : undefined} to="/cdd/deals" />
      <StatTile index={6} eyebrow="ENTITIES" value={firmsInQueue} label="With deals waiting" to="/cdd/deals" />

      <ActionTile
        index={7}
        actions={[
          { to: '/cdd/deals', label: 'Review deals', icon: <InboxIcon fontSize="small" />, primary: true },
          { to: '/settings/reporting-entities', label: 'Your firm', icon: <BusinessIcon fontSize="small" /> },
        ]}
      />
    </Bento>
  );
}
