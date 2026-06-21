import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/AddCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import { listDeals } from '../../api/deals.js';
import { Bento, HeroTile, StatTile, ListTile, ActionTile, SkeletonTiles, STATUS_META } from '../../components/bento/Bento.jsx';
import { DealRow } from '../../components/dashboard/DealRow.jsx';
import { formatNZDCompact } from '../../utils/formatters.js';
import { tokens } from '../../theme/theme.js';

const byUpdated = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
const sum = (deals) => deals.reduce((t, d) => t + (d.transactionValueNzd || 0), 0);

export function AgentDashboard() {
  const q = useQuery({ queryKey: ['deals', 'mine', 'ALL'], queryFn: () => listDeals() });

  if (q.isError) return <Alert severity="error">We couldn’t load your deals. Refresh to try again.</Alert>;
  if (q.isLoading) return <Bento><SkeletonTiles /></Bento>;

  const deals = q.data ?? [];
  const drafts = deals.filter((d) => d.status === 'DRAFT');
  const inReview = deals.filter((d) => d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW');
  const approved = deals.filter((d) => d.status === 'APPROVED');
  const open = drafts.length + inReview.length;
  const recent = [...deals].sort(byUpdated).slice(0, 5);

  return (
    <Bento>
      <HeroTile
        index={0}
        eyebrow="YOUR DESK · LIVE"
        value={open}
        label={open === 1 ? 'deal open' : 'deals open'}
        caption={`${approved.length} cleared to date · ${formatNZDCompact(sum(inReview))} in flight`}
        action={
          <Button component={RouterLink} to="/deals/new" startIcon={<AddIcon />}
                  sx={{ bgcolor: '#fff', color: tokens.blue, fontWeight: 700, '&:hover': { bgcolor: '#EEF3FF' } }}>
            Start a deal
          </Button>
        }
      />

      <StatTile index={1} eyebrow="DRAFT" dot={STATUS_META.DRAFT.c} value={drafts.length}
                label="In progress" to="/my-deals" />
      <StatTile index={2} eyebrow="IN REVIEW" dot={STATUS_META.UNDER_REVIEW.c} value={inReview.length}
                label="With compliance" color={inReview.length ? tokens.review : undefined} to="/my-deals" />
      <StatTile index={3} eyebrow="NZD · IN FLIGHT" cols={2} mono value={formatNZDCompact(sum(inReview))}
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

      <StatTile index={6} eyebrow="APPROVED" dot={STATUS_META.APPROVED.c} value={approved.length}
                label="Cleared" color={approved.length ? tokens.approved : undefined} to="/my-deals" />
      <StatTile index={7} eyebrow="ALL DEALS" value={deals.length} label="Total on your desk" to="/my-deals" />
    </Bento>
  );
}
