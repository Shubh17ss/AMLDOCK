import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/AddCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import { Bento, HeroTile, StatTile, ListTile, ActionTile, SkeletonTiles } from '../../components/bento/Bento.jsx';
import { dealStatusDot } from '../../data/dealStatus.js';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { countOf, useDealSample, useDealSummary, valueOf } from '../../dashboard/dealSummary.js';
import { DEALS_PATH } from '../../navigation/moduleRegistry.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { tokens } from '../../theme/theme.js';

// Deal worth is a min-max range, so totals take the upper bound — the conservative read
// for AML value thresholds. Pre-V28 deals only have the single transactionValue. The server
// computes it (valueOf) over every deal in scope.

export function AgentDashboard() {
  const q = useDealSummary();
  const recentQ = useDealSample({ size: 5, sort: 'updatedAt' });
  const money = useCurrency();

  if (q.isError) return <Alert severity="error">We couldn’t load your deals. Refresh to try again.</Alert>;
  if (q.isLoading) return <Bento><SkeletonTiles /></Bento>;
  const summary = q.data;
  // ON_HOLD sits with compliance too, but it is waiting on *this broker* to act, so it is
  // counted alongside their own in-progress work rather than as something in flight.
  const mine = countOf(summary, 'NEW', 'ON_HOLD');
  const inReview = countOf(summary, 'REVIEW');
  const verified = countOf(summary, 'VERIFIED', 'CLOSED');
  const inFlight = valueOf(summary, 'REVIEW');
  const open = mine + inReview;
  const recent = recentQ.data ?? [];

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="YOUR DESK · LIVE"
        value={open}
        label={open === 1 ? 'deal open' : 'deals open'}
        caption={`${verified} cleared to date · ${money.formatCompact(inFlight)} in flight`}
        action={
          <Button component={RouterLink} to="/deals/new" startIcon={<AddIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Start a deal
          </Button>
        }
      />

      <StatTile index={1} eyebrow="WITH YOU" dot={dealStatusDot('NEW')} value={mine}
                label="New or sent back" to={DEALS_PATH} />
      <StatTile index={2} eyebrow="IN REVIEW" dot={dealStatusDot('REVIEW')} value={inReview}
                label="With compliance" color={inReview ? tokens.review : undefined} to={DEALS_PATH} />
      <StatTile index={3} eyebrow={`${money.code} · IN FLIGHT`} cols={2} mono value={money.formatCompact(inFlight)}
                label="Value awaiting clearance" />

      <ListTile
        index={4}
        eyebrow="RECENT · UPDATED"
        title="Your recent deals"
        to={DEALS_PATH}
        items={recent}
        renderItem={(d) => <DealRow deal={d} />}
        empty="No deals yet — start your first to see it here."
      />

      <ActionTile
        index={5}
        actions={[
          { to: '/deals/new', label: 'New deal', icon: <AddIcon fontSize="small" />, primary: true },
          { to: DEALS_PATH, label: 'My deals', icon: <DescriptionIcon fontSize="small" /> },
        ]}
      />

      <StatTile index={6} eyebrow="VERIFIED" dot={dealStatusDot('VERIFIED')} value={verified}
                label="Cleared" color={verified ? tokens.approved : undefined} to={DEALS_PATH} />
      <StatTile index={7} eyebrow="ALL DEALS" value={summary.total} label="Total on your desk" to={DEALS_PATH} />
    </Bento>
  );
}
