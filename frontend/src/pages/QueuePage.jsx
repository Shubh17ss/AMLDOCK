import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { assignDeal, listDeals } from '../api/deals.js';
import { listFirms } from '../api/firms.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const STATUSES = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
const DEFAULT_STATUS = 'SUBMITTED';
const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

export function QueuePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [firmId, setFirmId] = useState('ALL');
  const [actionError, setActionError] = useState(null);

  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });

  const params = {};
  if (status !== 'ALL') params.status = status;
  if (firmId !== 'ALL') params.firmId = firmId;
  const dealsQ = useQuery({ queryKey: ['deals', 'queue', status, firmId], queryFn: () => listDeals(params) });

  const claimMut = useMutation({
    mutationFn: (id) => assignDeal(id),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      showToast({ severity: 'success', message: `Claimed ${deal.reference ?? `#${deal.id}`}` });
      navigate(`/deals/${deal.id}/review`);
    },
    onError: (e) => {
      const msg = e.response?.data?.message || 'Failed to claim';
      setActionError(msg);
      showToast({ severity: 'error', message: msg });
    },
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Compliance queue</Typography>

      <Stack direction="row" spacing={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="status-label">Status</InputLabel>
          <Select labelId="status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="firm-label">Firm</InputLabel>
          <Select labelId="firm-label" label="Firm" value={firmId} onChange={(e) => setFirmId(e.target.value)}>
            <MenuItem value="ALL">All firms</MenuItem>
            {(firmsQ.data ?? []).map((f) => (
              <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {dealsQ.isError && <Alert severity="error">Failed to load deals.</Alert>}
      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      {dealsQ.isLoading && <SkeletonTable rows={6} columns={10} />}

      {!dealsQ.isLoading && <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Reference</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Value (NZD)</TableCell>
              <TableCell>Firm</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Property</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(dealsQ.data ?? []).map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.reference ?? `#${d.id}`}</TableCell>
                <TableCell><DealStatusChip status={d.status} /></TableCell>
                <TableCell>{d.transactionType}</TableCell>
                <TableCell>{d.transactionValueNzd != null ? NZD.format(d.transactionValueNzd) : '—'}</TableCell>
                <TableCell>{d.firmName ?? '—'}</TableCell>
                <TableCell>{d.branchName ?? '—'}</TableCell>
                <TableCell>{d.clientDisplayName ?? '—'}</TableCell>
                <TableCell>{d.propertyAddress ?? '—'}</TableCell>
                <TableCell>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—'}</TableCell>
                <TableCell align="right">
                  {d.status === 'SUBMITTED' && (
                    <Button size="small" variant="contained" startIcon={<PlayArrowIcon />}
                            onClick={() => claimMut.mutate(d.id)}
                            disabled={claimMut.isPending}>
                      Claim
                    </Button>
                  )}
                  {d.status === 'UNDER_REVIEW' && (
                    <Button size="small" variant="outlined" onClick={() => navigate(`/deals/${d.id}/review`)}>
                      Open review
                    </Button>
                  )}
                  <Tooltip title="Open detail">
                    <IconButton size="small" onClick={() => navigate(`/deals/${d.id}`)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {(dealsQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No deals match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>}
    </Stack>
  );
}
