import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { listDeals } from '../api/deals.js';
import { DealsTable } from '../components/DealsTable.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';

const STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export function FirmDealsPage() {
  const [status, setStatus] = useState('ALL');
  const params = status === 'ALL' ? {} : { status };
  const q = useQuery({ queryKey: ['deals', 'firm', status], queryFn: () => listDeals(params) });

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Firm deals</Typography>

      <Stack direction="row" spacing={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="status-label">Status</InputLabel>
          <Select labelId="status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {q.isError && <Alert severity="error">Failed to load deals.</Alert>}

      {q.isLoading
        ? <SkeletonTable rows={6} columns={9} />
        : <DealsTable deals={q.data ?? []} emptyMessage="No deals from your firm yet." />}
    </Stack>
  );
}
