import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import InboxIcon from '@mui/icons-material/Inbox';
import BusinessIcon from '@mui/icons-material/Business';
import { Bento, HeroTile, StatTile, ListTile, ActionTile, SkeletonTiles } from '../../components/bento/Bento.jsx';
import { dealStatusDot } from '../../data/dealStatus.js';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { countOf, oldestOf, useDealSample, useDealSummary, valueOf } from '../../dashboard/dealSummary.js';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { tokens } from '../../theme/theme.js';

// Deal worth is a min-max range, so totals take the upper bound — the conservative read
// for AML value thresholds. Pre-V28 deals only have the single transactionValue. The server
// computes it (valueOf) over every deal in scope.

function oldestWait(oldestCreatedAt) {
  if (!oldestCreatedAt) return '—';
  const hrs = (Date.now() - new Date(oldestCreatedAt).getTime()) / 3600000;
  if (hrs < 1) return '<1h';
  if (hrs < 24) return `${Math.floor(hrs)}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function ReviewerDashboard() {
  const summaryQ = useDealSummary();
  // The next six to look at: review first, then on hold. On hold is a queue somebody has to
  // clear, which the old REJECTED never was — a parked deal needs a person to either resolve it
  // or send it back.
  const reviewQ = useDealSample({ status: 'REVIEW', size: 6 });
  const holdQ = useDealSample({ status: 'ON_HOLD', size: 6 });
  const money = useCurrency();

  if (summaryQ.isError) return <Alert severity="error">We couldn’t load the review queue. Refresh to try again.</Alert>;
  if (summaryQ.isLoading) return <Bento><SkeletonTiles /></Bento>;
  const summary = summaryQ.data;
  const underReview = countOf(summary, 'REVIEW');
  const onHold = countOf(summary, 'ON_HOLD');
  const awaitingValue = valueOf(summary, 'REVIEW');
  const firmsInQueue = summary.firmsAwaitingReview;
  const awaitingItems = [...(reviewQ.data ?? []), ...(holdQ.data ?? [])].slice(0, 6);
  const oldest = oldestWait(oldestOf(summary, 'REVIEW'));
  const oldestUrgent = oldest.endsWith('d') && parseInt(oldest, 10) >= 3;

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="DEALS · LIVE"
        value={underReview}
        label={underReview === 1 ? 'deal in review' : 'deals in review'}
        caption={`${onHold} on hold · ${money.formatCompact(awaitingValue)} awaiting clearance`}
        action={
          <Button component={RouterLink} to="/cdd/deals" startIcon={<InboxIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Open deals
          </Button>
        }
      />

      <StatTile index={1} eyebrow="IN REVIEW" dot={dealStatusDot('REVIEW')} value={underReview}
                label="With compliance" color={underReview ? tokens.review : undefined} to="/cdd/deals" />
      <StatTile index={2} eyebrow="ON HOLD" dot={dealStatusDot('ON_HOLD')} value={onHold}
                label="Parked, needing a decision" color={onHold ? tokens.rejected : undefined} to="/cdd/deals" />
      <StatTile index={3} eyebrow={`${money.code} · AWAITING`} cols={2} mono value={money.formatCompact(awaitingValue)}
                label="Transaction value in the queue" />

      <ListTile
        index={4}
        eyebrow="AWAITING · YOUR REVIEW"
        title="Next deals to review"
        to="/cdd/deals"
        items={awaitingItems}
        renderItem={(d) => <DealRow deal={d} />}
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
