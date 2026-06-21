import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { listDeals } from '../api/deals.js';
import { DealsTable } from '../components/DealsTable.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { DealCard } from '../components/DealCard.jsx';
import { StatusPills } from '../components/StatusPills.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import AddIcon from '@mui/icons-material/AddCircleOutline';
import { tokens, shadows } from '../theme/theme.js';

const STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export function MyDealsPage() {
  const [status, setStatus] = useState('ALL');
  const navigate = useNavigate();
  const params = status === 'ALL' ? {} : { status };
  const q = useQuery({ queryKey: ['deals', 'mine', status], queryFn: () => listDeals(params) });
  const deals = q.data ?? [];

  const isEmpty = !q.isLoading && deals.length === 0 && status === 'ALL';
  const isFiltered = !q.isLoading && deals.length === 0 && status !== 'ALL';

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={`${deals.length} ${deals.length === 1 ? 'deal' : 'deals'} · on your desk`}
        title="My deals"
        actions={
          <Button variant="contained" component={RouterLink} to="/deals/new" startIcon={<AddIcon />}>
            New deal
          </Button>
        }
      />

      {/* Status filter pills */}
      <StatusPills value={status} onChange={setStatus} options={STATUSES} />

      {q.isError && <Alert severity="error">Failed to load deals.</Alert>}

      {/* Mobile: card list */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 3.5 }}>
        {q.isLoading && (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        )}
        {isEmpty && (
          <MobileEmpty
            icon="📋"
            title="No deals yet"
            description="Start your first deal — capture the property, client, and IDs."
            action={<ActionBtn to="/deals/new">Create first deal</ActionBtn>}
          />
        )}
        {isFiltered && (
          <MobileEmpty icon="🔍" title="No results" description={`No deals with status "${status.toLowerCase()}".`} />
        )}
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} />
        ))}
      </Box>

      {/* Desktop: table */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {q.isLoading ? (
          <SkeletonTable rows={6} columns={9} />
        ) : isEmpty ? (
          <EmptyState
            icon={<HandshakeIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
            title="No deals yet"
            description="Start your first deal — pick a firm + branch, capture the property and client, attach IDs, and submit for review."
            action={
              <Button variant="contained" component={RouterLink} to="/deals/new">
                Create your first deal
              </Button>
            }
          />
        ) : (
          <DealsTable deals={deals} emptyMessage="No deals match this filter." />
        )}
      </Box>
    </Stack>
  );
}

function SkeletonCard() {
  return (
    <Box sx={{
      borderRadius: 4, p: 2.5, height: 140,
      border: `1px solid ${tokens.hairline}`,
      backgroundColor: '#F1F4F9',
      animation: 'pulse 1.5s ease-in-out infinite',
      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
    }} />
  );
}

function MobileEmpty({ icon, title, description, action }) {
  return (
    <Box sx={{
      borderRadius: 4, p: 4, textAlign: 'center',
      backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`,
    }}>
      <Typography sx={{ fontSize: '2rem', mb: 1 }}>{icon}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: tokens.ink, mb: 0.5 }}>{title}</Typography>
      {description && <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mb: 2 }}>{description}</Typography>}
      {action}
    </Box>
  );
}

function ActionBtn({ to, children }) {
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 3, px: 3, py: 1.25,
        fontSize: '0.85rem', fontWeight: 700,
        color: '#fff', backgroundColor: tokens.blue,
        textDecoration: 'none',
        boxShadow: shadows.sm,
      }}
    >
      {children}
    </Box>
  );
}
