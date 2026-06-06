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

const STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

const EXT_SM = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET_SM = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

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
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>My deals</Typography>
        <Box
          component={RouterLink}
          to="/deals/new"
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            borderRadius: 3, px: 2, py: 1,
            fontSize: '0.85rem', fontWeight: 700,
            color: '#fff', backgroundColor: '#6C63FF',
            textDecoration: 'none',
            boxShadow: EXT_SM,
            transition: 'box-shadow 0.2s ease',
            '&:active': { boxShadow: INSET_SM },
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
          New deal
        </Box>
      </Box>

      {/* Status filter pills */}
      <StatusPills value={status} onChange={setStatus} options={STATUSES} />

      {q.isError && <Alert severity="error">Failed to load deals.</Alert>}

      {/* Mobile: card list */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
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
      boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.4), inset -6px -6px 10px rgba(255,255,255,0.4)',
      backgroundColor: '#E0E5EC',
      animation: 'pulse 1.5s ease-in-out infinite',
      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
    }} />
  );
}

function MobileEmpty({ icon, title, description, action }) {
  return (
    <Box sx={{
      borderRadius: 4, p: 4, textAlign: 'center',
      boxShadow: 'inset 6px 6px 10px rgb(163,177,198,0.4), inset -6px -6px 10px rgba(255,255,255,0.4)',
    }}>
      <Typography sx={{ fontSize: '2rem', mb: 1 }}>{icon}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#3D4852', mb: 0.5 }}>{title}</Typography>
      {description && <Typography sx={{ fontSize: '0.85rem', color: '#6B7280', mb: 2 }}>{description}</Typography>}
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
        color: '#fff', backgroundColor: '#6C63FF',
        textDecoration: 'none',
        boxShadow: EXT_SM,
      }}
    >
      {children}
    </Box>
  );
}
