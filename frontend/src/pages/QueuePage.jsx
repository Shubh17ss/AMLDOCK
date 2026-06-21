import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, FormControl, IconButton, InputLabel, MenuItem, Paper,
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
import { DealCard } from '../components/DealCard.jsx';
import { StatusPills } from '../components/StatusPills.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { tokens } from '../theme/theme.js';

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
  const deals = dealsQ.data ?? [];

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
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={`${deals.length} ${deals.length === 1 ? 'deal' : 'deals'} · ${status === 'ALL' ? 'all statuses' : status.replace('_', ' ').toLowerCase()}`}
        title="Compliance queue"
      />

      {/* Status filter — pills on mobile, selects on desktop */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <StatusPills value={status} onChange={setStatus} options={STATUSES} />
      </Box>

      {/* Firm filter — mobile chip row */}
      {(firmsQ.data ?? []).length > 0 && (
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {['ALL', ...(firmsQ.data ?? []).map(f => f.id)].map((fid) => {
            const label = fid === 'ALL' ? 'All firms' : (firmsQ.data ?? []).find(f => f.id === fid)?.name ?? fid;
            const active = firmId === fid;
            return (
              <Box
                key={fid}
                component="button"
                onClick={() => setFirmId(fid)}
                sx={{
                  border: 'none', borderRadius: 999, px: 2, py: 0.75,
                  fontSize: '0.72rem', fontWeight: active ? 700 : 500,
                  color: active ? tokens.blue : tokens.muted,
                  backgroundColor: active ? tokens.blueWash : tokens.tile,
                  border: `1px solid ${active ? 'transparent' : tokens.hairline}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Desktop filters */}
      <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
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

      {/* Mobile: card list */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {dealsQ.isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        {!dealsQ.isLoading && deals.length === 0 && (
          <Box sx={{
            borderRadius: 4, p: 4, textAlign: 'center',
            backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`,
          }}>
            <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>📥</Typography>
            <Typography sx={{ fontWeight: 700, color: tokens.ink }}>Queue is clear</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>No deals match this filter.</Typography>
          </Box>
        )}
        {deals.map((d) => (
          <DealCard
            key={d.id}
            deal={d}
            onClaim={d.status === 'SUBMITTED' ? claimMut.mutate : undefined}
            onReview={d.status === 'UNDER_REVIEW' ? true : undefined}
            claimPending={claimMut.isPending}
          />
        ))}
      </Box>

      {/* Desktop: table */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {dealsQ.isLoading && <SkeletonTable rows={6} columns={10} />}
        {!dealsQ.isLoading && (
          <TableContainer component={Paper}>
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
                {deals.map((d) => (
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
                          onClick={() => claimMut.mutate(d.id)} disabled={claimMut.isPending}>
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
                {deals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No deals match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
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
      '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
    }} />
  );
}
