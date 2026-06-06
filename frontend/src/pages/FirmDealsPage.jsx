import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { listDeals } from '../api/deals.js';
import { DealsTable } from '../components/DealsTable.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { DealCard } from '../components/DealCard.jsx';
import { StatusPills } from '../components/StatusPills.jsx';

const STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export function FirmDealsPage() {
  const [status, setStatus] = useState('ALL');
  const params = status === 'ALL' ? {} : { status };
  const q = useQuery({ queryKey: ['deals', 'firm', status], queryFn: () => listDeals(params) });
  const deals = q.data ?? [];

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Firm deals</Typography>

      {/* Status filter pills */}
      <StatusPills value={status} onChange={setStatus} options={STATUSES} />

      {q.isError && <Alert severity="error">Failed to load deals.</Alert>}

      {/* Mobile: card list */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {q.isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        {!q.isLoading && deals.length === 0 && (
          <Box sx={{
            borderRadius: 4, p: 4, textAlign: 'center',
            boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.4), inset -6px -6px 10px rgba(255,255,255,0.4)',
          }}>
            <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>📁</Typography>
            <Typography sx={{ fontWeight: 700, color: '#3D4852' }}>No deals yet</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#6B7280', mt: 0.5 }}>
              {status === 'ALL' ? 'No deals from your firm yet.' : 'No deals match this filter.'}
            </Typography>
          </Box>
        )}
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} />
        ))}
      </Box>

      {/* Desktop: table */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {q.isLoading
          ? <SkeletonTable rows={6} columns={9} />
          : <DealsTable deals={deals} emptyMessage={status === 'ALL' ? 'No deals from your firm yet.' : 'No deals match this filter.'} />
        }
      </Box>
    </Stack>
  );
}

function SkeletonCard() {
  return (
    <Box sx={{
      borderRadius: 4, p: 2.5, height: 140,
      boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.4), inset -6px -6px 10px rgba(255,255,255,0.4)',
      backgroundColor: '#E0E5EC',
      animation: 'pulse 1.5s ease-in-out infinite',
      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
    }} />
  );
}
