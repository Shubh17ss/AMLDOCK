import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddCircleOutline';
import { listDeals } from '../api/deals.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canCreateDeal, isDealAuthor } from '../auth/roles.js';
import { useDashboardScope, useScopedDeals } from '../dashboard/DashboardScope.jsx';
import { useCurrency } from '../dashboard/useCurrency.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { RiskRatingChip } from '../components/RiskRatingChip.jsx';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { DealCard } from '../components/DealCard.jsx';
import { SearchField, matchesSearch } from '../components/SearchField.jsx';
import { DEAL_STATUS_FILTERS as STATUSES, dealStatusLabel, opensDealForm } from '../data/dealStatus.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { tokens } from '../theme/theme.js';

const DEFAULT_STATUS = 'ALL';

/**
 * Deals — the full deal list, filtered by status tabs and searched by property.
 *
 * The two filters work differently on purpose. Status is a server parameter, because it narrows
 * the set the server would otherwise send in full. The property search is client-side over that
 * result: the address is already on every row, so searching it costs one pass over an array
 * rather than a round trip per keystroke.
 *
 * Firm/branch narrowing comes from the sidebar scope selector, so the list always matches the
 * workspace scope.
 *
 * There is no claim step: a deal belongs to the firm's compliance function rather than to one
 * officer, so the review workspace is open to any reviewer from submission onward.
 */
export function DealsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const money = useCurrency();
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [query, setQuery] = useState('');

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
  const scoped = useScopedDeals(dealsQ.data);
  const deals = useMemo(
    () => scoped.filter((d) => matchesSearch(query, d.propertyAddress)),
    [scoped, query],
  );

  // "You have no deals" and "nothing matches this filter" are different messages and want different
  // answers — the first is a first-run screen and should invite the one action that fixes it, the
  // second should not, because creating a deal is not how you find an existing one.
  const filtered = status !== 'ALL' || query.trim() !== '';
  const isEmpty = !dealsQ.isLoading && deals.length === 0 && !filtered;
  const mayCreate = canCreateDeal(user?.role);

  /**
   * Where a row goes when you open it.
   *
   * Only the broker who owns an unfinished deal wants the form: the thing to do with their own
   * half-written deal is finish it. Everyone else — reviewers included — wants the deal page,
   * where the ownership structure is and where the record is editable in the drawer.
   *
   * The author test carries the owner check the page guards have always made. Without it a broker
   * opening a colleague's NEW deal was linked to the form only to be bounced straight back.
   */
  const opensForm = (d) => opensDealForm(d, user);
  const openPathFor = (d) => (opensForm(d) ? `/deals/${d.id}/edit` : `/deals/${d.id}`);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}`,
          status === 'ALL' ? 'all statuses' : dealStatusLabel(status).toLowerCase(),
          query.trim() ? `matching "${query.trim()}"` : null,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title={isDealAuthor(user?.role) ? 'My deals' : 'Listing Register'}
      />

      {/* One status at a time, as tabs. Scrollable rather than responsive-by-breakpoint: the
          same control works on a phone, so there is one filter here instead of two that could
          drift apart. Firm/branch still come from the sidebar scope. */}
      <Tabs
        value={status}
        onChange={(_, v) => setStatus(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 40,
          borderBottom: `1px solid ${tokens.hairline}`,
          '& .MuiTab-root': {
            minHeight: 40, textTransform: 'none', fontWeight: 600,
            fontSize: '0.82rem', color: tokens.muted,
          },
          '& .Mui-selected': { color: tokens.blue },
        }}
      >
        {STATUSES.map((s) => <Tab key={s} value={s} label={dealStatusLabel(s)} />)}
      </Tabs>

      {/* Two layouts, one row of controls. On a desktop the field is capped at 320px and the
          button sits at the far right of the same line. On a phone they stack and each takes the
          full column width, so they line up with the deal cards they act on rather than floating
          at desktop measures inside a wider list — and at 52px they are proper touch targets. */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ flexWrap: { xs: 'nowrap', md: 'wrap' }, gap: 1.5 }}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by property…"
          sx={{
            width: { xs: '100%', md: 'auto' },
            maxWidth: { xs: 'none', md: 320 },
            '& .MuiOutlinedInput-root': { minHeight: { xs: 52, md: 0 } },
          }}
        />
        {/* Guarded, not decorative: this list is open to every role, including ones the server
            refuses to let create a deal at all — an ungated button would bounce them to /app. */}
        {mayCreate && (
          <Button
            variant="contained"
            component={RouterLink}
            to="/deals/new"
            startIcon={<AddIcon />}
            sx={{
              width: { xs: '100%', md: 'auto' },
              minHeight: { xs: 52, md: 0 },
              fontSize: { xs: '0.95rem', md: '0.875rem' },
            }}
          >
            Create Deal
          </Button>
        )}
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
            <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>{isEmpty ? '📋' : '🔍'}</Typography>
            <Typography sx={{ fontWeight: 700, color: tokens.ink }}>
              {isEmpty ? 'No deals yet' : 'No results'}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
              {isEmpty
                ? 'Start your first deal — capture the property, client, and IDs.'
                : 'No deals match these filters.'}
            </Typography>
            {isEmpty && mayCreate && (
              <Button variant="contained" component={RouterLink} to="/deals/new"
                      startIcon={<AddIcon />} sx={{ mt: 2 }}>
                Create first deal
              </Button>
            )}
          </Box>
        )}
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} canEdit={opensForm(d)} />
        ))}
      </Box>

      {/* Desktop: table */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {dealsQ.isLoading && <SkeletonTable rows={6} columns={9} />}
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
                  {/* <TableCell>Reporting entity</TableCell> */}
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
                    {/* <TableCell>{d.firmName ?? '—'}</TableCell> */}
                    <TableCell>{d.clientDisplayName ?? '—'}</TableCell>
                    <TableCell>{d.propertyAddress ?? '—'}</TableCell>
                    <TableCell>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—'}</TableCell>
                    <TableCell align="right">
                      {/* One way in, labelled. `secondary` is the theme's ink-on-canvas button —
                          black here, and it inverts with the rest of the surface in dark mode. */}
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        onClick={() => navigate(openPathFor(d))}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {deals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 5, color: tokens.muted }}>
                      {isEmpty ? (
                        <Stack spacing={1.5} alignItems="center">
                          <Typography sx={{ fontWeight: 700, color: tokens.ink }}>No deals yet</Typography>
                          <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, maxWidth: 420 }}>
                            Start your first deal — capture the property and client, attach IDs, and
                            submit it for review.
                          </Typography>
                          {mayCreate && (
                            <Button variant="contained" component={RouterLink} to="/deals/new"
                                    startIcon={<AddIcon />}>
                              Create your first deal
                            </Button>
                          )}
                        </Stack>
                      ) : 'No deals match these filters.'}
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
