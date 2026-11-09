import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert, Box, IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { listAssurance } from '../../api/assurance.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canWrite, isDealReviewer } from '../../auth/roles.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { DateField } from '../../components/DateField.jsx';
import { DealStatusChip } from '../../components/DealStatusChip.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { ListPagination, countText } from '../../components/ListPagination.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { tokens, fonts } from '../../theme/theme.js';
import { formatDateTimeNumeric } from '../../utils/formatters.js';
import {
  AssuranceChip, AssuranceDialog, IssuesDialog, VersionChip,
} from '../../features/deal/assurance/AssuranceDialog.jsx';

const COLUMNS = 7;

/** The start or end of a local calendar day, as the instant the server filters on. */
const dayBound = (ymd, end) => {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split('-').map(Number);
  const at = end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return at.toISOString();
};

/**
 * Compliance's second look at deals it has already signed off.
 *
 * <p>One row per verified or closed deal, showing the version the deal currently stands on and
 * its verdict. Assurance is recorded on a version rather than the deal because a sign-off is per
 * version; older versions are history and stay readable from the deal's version tab (View).
 *
 * <p>Search, the date range, the "awaiting" count and paging all run on the server: the register
 * used to arrive whole, every version of every deal, and was filtered here. Scope is the server's
 * too, like every CDD register. The date range keeps a deal whose latest version was verified, or
 * which was closed, inside it.
 */
export function CddAssurancePage() {
  const { firm, branch } = useDashboardScope();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fromAt = dayBound(from, false);
  const toAt = dayBound(to, true);
  const scope = { firmId: firm?.id, branchId: branch?.id };
  const paged = usePagedList({ resetOn: [firm?.id, branch?.id, fromAt, toAt] });
  const query = paged.search;

  const q = useQuery({
    queryKey: ['assurance', firm?.id ?? null, branch?.id ?? null, fromAt ?? null, toAt ?? null, paged.params],
    queryFn: () => listAssurance({ ...scope, from: fromAt, to: toAt, ...paged.params }),
    // Keeps the table on screen while a new page or range loads, rather than flashing the skeleton.
    placeholderData: keepPreviousData,
  });
  // Only the count is wanted, so one row is enough to read totalElements.
  const awaitingQ = useQuery({
    queryKey: ['assurance', 'awaiting', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listAssurance({ ...scope, assurance: 'AWAITING', size: 1 }),
  });

  const rows = q.data?.items ?? [];
  const total = q.data?.totalElements ?? 0;
  const awaiting = awaitingQ.data?.totalElements ?? 0;
  const ranged = Boolean(from || to);
  const rangeInverted = Boolean(from && to && from > to);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${countText(q.data)} ${total === 1 ? 'deal' : 'deals'} signed off`,
          awaiting > 0 ? `${countText(awaitingQ.data)} awaiting assurance` : null,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Assurance"
      />

      {/* The two dates sit right beside the search on a desktop and drop underneath on a phone,
          where the search takes the full width. */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-start' }}>
        <SearchField
          value={query}
          onChange={paged.setSearch}
          placeholder="Search property address…"
          sx={{ maxWidth: { xs: '100%', md: 320 }, width: '100%' }}
        />
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Box sx={{ width: { xs: '50%', md: 200 } }}>
            <DateField label="From" value={from} onChange={setFrom} size="small" fullWidth maxDate={to || undefined} />
          </Box>
          <Box sx={{ width: { xs: '50%', md: 200 } }}>
            <DateField label="To" value={to} onChange={setTo} size="small" fullWidth minDate={from || undefined} />
          </Box>
        </Stack>
      </Stack>

      {rangeInverted && (
        <Alert severity="warning">The From date is after the To date, so nothing can match.</Alert>
      )}

      {q.isError && (
        <Alert severity="error">Failed to load the register. Refresh to try again.</Alert>
      )}

      {q.isLoading
        ? <SkeletonTable rows={6} columns={COLUMNS} />
        : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Assurance</TableCell>
                  <TableCell>Last updated</TableCell>
                  <TableCell>Marked by</TableCell>
                  <TableCell align="right" sx={{ width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => <DealRow key={r.deal.id} deal={r.deal} version={r.latestVersion} />)}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS} align="center" sx={{ py: 5, color: tokens.muted }}>
                      {query.trim()
                        ? 'No deal matches that search.'
                        : ranged
                          ? 'No deal was verified or closed in that date range.'
                          : 'No verified or closed deal in scope yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ListPagination data={q.data} paged={paged} />
          </TableContainer>
        )}
    </Stack>
  );
}

/** A deal and the version it stands on, with that version's verdict. */
function DealRow({ deal, version: v }) {
  const label = deal.propertyAddress ?? deal.reference;
  return (
    <TableRow hover>
      <TableCell>
        <Tooltip title={deal.propertyAddress ?? ''}>
          <Box
            component={RouterLink}
            to={`/deals/${deal.id}`}
            // The Listing Register's link treatment: ink at rest, blue and underlined on hover.
            sx={{
              display: 'inline-block', maxWidth: 380, verticalAlign: 'bottom',
              fontWeight: 700, color: tokens.ink, textDecoration: 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              '&:hover': { color: tokens.blue, textDecoration: 'underline' },
            }}
          >
            {label}
          </Box>
        </Tooltip>
      </TableCell>
      <TableCell><DealStatusChip status={deal.status} /></TableCell>
      {v
        ? (
          <>
            <TableCell><VersionChip no={v.versionNo} /></TableCell>
            <TableCell>
              <AssuranceChip status={v.assuranceStatus} />
              {v.assuranceStatus === 'ACTION_REQUIRED' && v.issues?.length > 0 && (
                <Typography component="span" variant="caption" sx={{ ml: 1, color: tokens.muted }}>
                  {v.issues.length} {v.issues.length === 1 ? 'issue' : 'issues'}
                </Typography>
              )}
            </TableCell>
            <TableCell><Stamp at={v.assuranceAt} /></TableCell>
            <TableCell sx={{ fontSize: '0.85rem', color: v.assuranceByName ? tokens.ink : tokens.muted }}>
              {v.assuranceStatus ? (v.assuranceByName ?? '—') : '—'}
            </TableCell>
            <TableCell align="right"><VersionMenu deal={deal} version={v} /></TableCell>
          </>
        )
        : (
          // Verified before versions existed: nothing was frozen, so there is nothing to assure.
          <TableCell colSpan={COLUMNS - 2}>
            <Typography variant="caption" sx={{ color: tokens.muted }}>No signed-off version</Typography>
          </TableCell>
        )}
    </TableRow>
  );
}

/**
 * What can be done to one version, behind one button.
 *
 * <p>Same shape as the deals list's row menu: items that do not apply are hidden rather than
 * disabled, so the menu says what you can do. Recording a verdict is one item whatever the
 * current one is — the dialog itself offers both results.
 */
function VersionMenu({ deal, version: v }) {
  const { user } = useAuth();
  const [anchor, setAnchor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);

  const mayMark = isDealReviewer(user?.role) && canWrite(user?.role);
  const hasIssues = v.assuranceStatus === 'ACTION_REQUIRED' && v.issues?.length > 0;

  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          aria-label={`Actions for v${v.versionNo} of ${deal.reference}`}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={close}>
        {/* The deal screen reads ?version= and renders the snapshot read-only. */}
        <MenuItem component={RouterLink} to={`/deals/${deal.id}?version=${v.versionNo}`} onClick={close}>
          <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> View
        </MenuItem>

        {/* Reading, not marking, so it is not gated on mayMark: an auditor checking the register
            needs the findings as much as the reviewer who recorded them. */}
        {hasIssues && (
          <MenuItem onClick={() => { close(); setViewing(true); }}>
            <ReportProblemOutlinedIcon fontSize="small" sx={{ mr: 1, color: tokens.rejected }} /> Show issues
          </MenuItem>
        )}

        {mayMark && (
          <MenuItem onClick={() => { close(); setEditing(true); }}>
            <FactCheckOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Update assurance
          </MenuItem>
        )}
      </Menu>

      <AssuranceDialog open={editing} deal={deal} version={v} onClose={() => setEditing(false)} />
      <IssuesDialog open={viewing} deal={deal} version={v} onClose={() => setViewing(false)} />
    </>
  );
}

/** dd/mm/yyyy hh:mm, or a dash while nothing has been recorded. */
function Stamp({ at }) {
  const text = formatDateTimeNumeric(at);
  return (
    <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.8rem', color: text ? tokens.ink : tokens.muted }}>
      {text ?? '—'}
    </Typography>
  );
}
