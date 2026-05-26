import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { listDeals } from '../api/deals.js';
import { DealsTable } from '../components/DealsTable.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

const STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export function MyDealsPage() {
  const [status, setStatus] = useState('ALL');
  const navigate = useNavigate();
  const params = status === 'ALL' ? {} : { status };
  const q = useQuery({ queryKey: ['deals', 'mine', status], queryFn: () => listDeals(params) });

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">My deals</Typography>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/deals/new">
          New deal
        </Button>
      </Stack>

      <Stack direction="row" spacing={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="status-label">Status</InputLabel>
          <Select labelId="status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {q.isError && <Alert severity="error">Failed to load deals.</Alert>}

      {q.isLoading ? (
        <SkeletonTable rows={6} columns={9} />
      ) : (q.data ?? []).length === 0 && status === 'ALL' ? (
        <EmptyState
          icon={<HandshakeIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
          title="No deals yet"
          description="Start your first deal — pick a real-estate firm + branch, capture the property and client, attach IDs, and submit for review."
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/deals/new')}>
              Create your first deal
            </Button>
          }
        />
      ) : (
        <DealsTable deals={q.data ?? []} emptyMessage="No deals match this filter." />
      )}
    </Stack>
  );
}
