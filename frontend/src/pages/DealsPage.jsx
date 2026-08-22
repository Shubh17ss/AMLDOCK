import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, FormControl, IconButton, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { listDeals } from '../api/deals.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { DEAL_REVIEWER_ROLES } from '../auth/roles.js';
import { useDashboardScope, useScopedDeals } from '../dashboard/DashboardScope.jsx';
import { useCurrency } from '../dashboard/useCurrency.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { RiskRatingChip } from '../components/RiskRatingChip.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { DealCard } from '../components/DealCard.jsx';
import { StatusPills } from '../components/StatusPills.jsx';
import { DEAL_STATUS_FILTERS as STATUSES, dealStatusLabel, isReviewable } from '../data/dealStatus.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { tokens } from '../theme/theme.js';

const DEFAULT_STATUS = 'ALL';

/**
 * Deals — the full deal list with a status filter. Firm/branch narrowing comes from the sidebar
 * scope selector, so the list always matches the workspace scope.
 *
 * There is no claim step: a deal belongs to the firm's compliance function rather than to one
 * officer, so the review workspace is open to any reviewer from handover onward.
 */
export function DealsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const money = useCurrency();
  const [status, setStatus] = useState(DEFAULT_STATUS);

  // ROOT is deliberately absent: the review workspace is guarded by DEAL_REVIEWER_ROLES, so
  // offering ROOT a way in only leads to a redirect, and it could never act there anyway.
  const canReview = Boolean(user) && DEAL_REVIEWER_ROLES.includes(user.role);

  // The backend enforces role scope regardless; ROOT and firm-level reviewers get
  // real firm/branch filtering from these params.
  const params = {};
  if (status !== 'ALL') params.status = status;
  if (firm?.id) params.firmId = firm.id;
  if (branch?.id) params.branchId = branch.id;
  const dealsQ = useQuery({
    queryKey: ['deals', 'list', status, firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listDeals(params),
  });
  // Belt-and-braces: also narrow client-side by the scope's firm/branch names.
  const deals = useScopedDeals(dealsQ.data);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}`,
          status === 'ALL' ? 'all statuses' : dealStatusLabel(status).toLowerCase(),
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Deals"
      />

      {/* Status filter — pills on mobile, select on desktop. Firm/branch come from the sidebar scope. */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <StatusPills value={status} onChange={setStatus} options={STATUSES} />
      </Box>
      <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', md: 'flex' } }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="status-label">Status</InputLabel>
          <Select labelId="status-label" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{dealStatusLabel(s)}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {dealsQ.isError && <Alert severity="error">Failed to load deals.</Alert>}

      {/* Mobile: card list */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {dealsQ.isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        {!dealsQ.isLoading && deals.length === 0 && (
          <Box sx={{
            borderRadius: 4, p: 4, textAlign: 'center',
            backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`,
          }}>
            <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>📁</Typography>
            <Typography sx={{ fontWeight: 700, color: tokens.ink }}>No deals</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>No deals match this filter.</Typography>
          </Box>
        )}
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} onReview={canReview || undefined} />
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
                  <TableCell>Risk</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Value ({money.code})</TableCell>
                  <TableCell>Reporting entity</TableCell>
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
                    <TableCell><RiskRatingChip rating={d.riskRating} /></TableCell>
                    <TableCell>{d.transactionType}</TableCell>
                    <TableCell>{money.dealRange(d)}</TableCell>
                    <TableCell>{d.firmName ?? '—'}</TableCell>
                    <TableCell>{d.branchName ?? '—'}</TableCell>
                    <TableCell>{d.clientDisplayName ?? '—'}</TableCell>
                    <TableCell>{d.propertyAddress ?? '—'}</TableCell>
                    <TableCell>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right">
                      {canReview && isReviewable(d.status) && (
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
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: tokens.muted }}>
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
