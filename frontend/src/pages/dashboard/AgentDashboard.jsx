import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/AddCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import { listDeals } from '../../api/deals.js';
import { Bento, HeroTile, StatTile, ListTile, ActionTile, SkeletonTiles } from '../../components/bento/Bento.jsx';
import { dealStatusDot } from '../../data/dealStatus.js';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { useScopedDeals } from '../../dashboard/DashboardScope.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { tokens } from '../../theme/theme.js';

const byUpdated = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
// Deal worth is a min-max range, so totals take the upper bound — the conservative read
// for AML value thresholds. Pre-V28 deals only have the single transactionValue.
const sum = (deals) => deals.reduce((t, d) => t + (d.valuationMax ?? d.transactionValue ?? 0), 0);

export function AgentDashboard() {
  const q = useQuery({ queryKey: ['deals', 'mine', 'ALL'], queryFn: () => listDeals() });
  const deals = useScopedDeals(q.data);
  const money = useCurrency();

  if (q.isError) return <Alert severity="error">We couldn’t load your deals. Refresh to try again.</Alert>;
  if (q.isLoading) return <Bento><SkeletonTiles /></Bento>;
  // ON_HOLD sits with compliance too, but it is waiting on *this broker* to act, so it is
  // counted alongside their own in-progress work rather than as something in flight.
  const mine = deals.filter((d) => d.status === 'NEW' || d.status === 'ON_HOLD');
  const inReview = deals.filter((d) => d.status === 'HANDOVER' || d.status === 'REVIEW');
  const verified = deals.filter((d) => d.status === 'VERIFIED' || d.status === 'CLOSED');
  const open = mine.length + inReview.length;
  const recent = [...deals].sort(byUpdated).slice(0, 5);

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="YOUR DESK · LIVE"
        value={open}
        label={open === 1 ? 'deal open' : 'deals open'}
        caption={`${verified.length} cleared to date · ${money.formatCompact(sum(inReview))} in flight`}
        action={
          <Button component={RouterLink} to="/deals/new" startIcon={<AddIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Start a deal
          </Button>
        }
      />

      <StatTile index={1} eyebrow="WITH YOU" dot={dealStatusDot('NEW')} value={mine.length}
                label="New or sent back" to="/my-deals" />
      <StatTile index={2} eyebrow="IN REVIEW" dot={dealStatusDot('REVIEW')} value={inReview.length}
                label="With compliance" color={inReview.length ? tokens.review : undefined} to="/my-deals" />
      <StatTile index={3} eyebrow={`${money.code} · IN FLIGHT`} cols={2} mono value={money.formatCompact(sum(inReview))}
                label="Value awaiting clearance" />

      <ListTile
        index={4}
        eyebrow="RECENT · UPDATED"
        title="Your recent deals"
        to="/my-deals"
        items={recent}
        renderItem={(d) => <DealRow deal={d} />}
        empty="No deals yet — start your first to see it here."
      />

      <ActionTile
        index={5}
        actions={[
          { to: '/deals/new', label: 'New deal', icon: <AddIcon fontSize="small" />, primary: true },
          { to: '/my-deals', label: 'My deals', icon: <DescriptionIcon fontSize="small" /> },
        ]}
      />

      <StatTile index={6} eyebrow="VERIFIED" dot={dealStatusDot('VERIFIED')} value={verified.length}
                label="Cleared" color={verified.length ? tokens.approved : undefined} to="/my-deals" />
      <StatTile index={7} eyebrow="ALL DEALS" value={deals.length} label="Total on your desk" to="/my-deals" />
    </Bento>
  );
}
