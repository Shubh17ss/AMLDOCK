import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { listAssurance, updateAssurance } from '../../api/assurance.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canWrite, isDealReviewer } from '../../auth/roles.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { DateField } from '../../components/DateField.jsx';
import { DealStatusChip } from '../../components/DealStatusChip.jsx';
import { OptionPill } from '../../components/OptionPill.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { ListPagination, countText } from '../../components/ListPagination.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens, fonts } from '../../theme/theme.js';
import { formatDateTimeNumeric } from '../../utils/formatters.js';

const COLUMNS = 7;

/** A well background: a light grey in light mode, a lifted shade in dark. Used by the issues dialog. */
const VERSIONS_BG = `color-mix(in srgb, ${tokens.muted} 8%, ${tokens.tile})`;

/** How each verdict reads, and in what colour. Null is "not reviewed". */
const ASSURANCE_META = {
  ASSURED:         { label: 'Assured',         color: 'success' },
  ACTION_REQUIRED: { label: 'Action required', color: 'error' },
};

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
          placeholder="Search property, deal or client…"
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

/**
 * Records the result of an assurance: Passed, or Action required with what was found.
 *
 * <p>Nothing is saved until Update. An action-required result is built up here a finding at a
 * time — the issue, the remediation planned for it, Add — and sent as one list that replaces the
 * stored one. Passing sends no issues, and that is what clears any recorded before.
 */
function AssuranceDialog({ open, deal, version: v, onClose }) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState(null); // 'ASSURED' | 'ACTION_REQUIRED' | null
  const [issues, setIssues] = useState([]);
  const [issue, setIssue] = useState('');
  const [remediation, setRemediation] = useState('');
  const [error, setError] = useState(null);

  // Opens on where the version stands, so amending an action-required list starts from it.
  useEffect(() => {
    if (!open) return;
    setResult(v.assuranceStatus ?? null);
    setIssues((v.issues ?? []).map((i) => ({ ...i })));
    setIssue('');
    setRemediation('');
    setError(null);
  }, [open, v]);

  const mut = useMutation({
    mutationFn: () => updateAssurance(deal.id, v.versionNo, {
      status: result,
      issues: result === 'ACTION_REQUIRED' ? issues : [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assurance'] });
      qc.invalidateQueries({ queryKey: ['dealVersions', deal.id] });
      showToast({
        severity: 'success',
        message: `v${v.versionNo} of ${deal.reference} marked `
          + (result === 'ASSURED' ? 'assured' : 'action required'),
      });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  const canAdd = issue.trim().length >= 3 && remediation.trim().length >= 3;
  const addIssue = () => {
    if (!canAdd) return;
    setIssues((list) => [...list, { issue: issue.trim(), remediation: remediation.trim() }]);
    setIssue('');
    setRemediation('');
  };

  const ready = result === 'ASSURED' || (result === 'ACTION_REQUIRED' && issues.length > 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span">Update assurance</Box>
          <VersionChip no={v.versionNo} />
        </Stack>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
          {deal.propertyAddress ?? deal.reference}
          {deal.propertyAddress ? ` · ${deal.reference}` : ''}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, mb: 1.25 }}>
          What is the result of your assurance?
        </Typography>
        {/* Two equal halves, as in the design; the same pill the status dialog uses. */}
        <Stack direction="row" spacing={1.5} role="radiogroup" aria-label="Assurance result">
          <OptionPill
            label="Action required"
            fg={tokens.rejected}
            bg="var(--cl-err-wash)"
            selected={result === 'ACTION_REQUIRED'}
            onSelect={() => { setResult('ACTION_REQUIRED'); setError(null); }}
            sx={{ flex: 1, justifyContent: 'center', py: 1.25, fontSize: '0.9rem' }}
          />
          <OptionPill
            label="Passed"
            fg={tokens.approved}
            bg="var(--cl-ok-wash)"
            selected={result === 'ASSURED'}
            onSelect={() => { setResult('ASSURED'); setError(null); }}
            sx={{ flex: 1, justifyContent: 'center', py: 1.25, fontSize: '0.9rem' }}
          />
        </Stack>

        {result === 'ASSURED' && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 2.5 }}>
            {v.issues?.length
              ? 'Marking it assured removes the issues recorded against this version.'
              : 'This signed-off version holds up on review. No note is needed.'}
          </Typography>
        )}

        {result === 'ACTION_REQUIRED' && (
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <TextField
              label="Identified issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Planned remediation"
              value={remediation}
              onChange={(e) => setRemediation(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addIssue}
              disabled={!canAdd}
              fullWidth
            >
              Add identified issue
            </Button>

            <Box sx={{ pt: 1, borderTop: `1px solid ${tokens.hairline}` }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, mb: 1 }}>
                Identified issues
              </Typography>
              <IssueList
                issues={issues}
                onRemove={(idx) => setIssues((list) => list.filter((_, i) => i !== idx))}
              />
            </Box>
          </Stack>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={mut.isPending}>Cancel</Button>
        <Button
          variant="contained"
          color={result === 'ACTION_REQUIRED' ? 'error' : 'primary'}
          disabled={!ready || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Working…' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The recorded findings on an action-required version, read-only. */
function IssuesDialog({ open, deal, version: v, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span">Identified issues</Box>
          <VersionChip no={v.versionNo} />
          <AssuranceChip status={v.assuranceStatus} />
        </Stack>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
          {deal.propertyAddress ?? deal.reference}
          {deal.propertyAddress ? ` · ${deal.reference}` : ''}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <IssueList issues={v.issues ?? []} />
        <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: tokens.muted }}>
          {[v.assuranceByName ? `Recorded by ${v.assuranceByName}` : 'Recorded',
            formatDateTimeNumeric(v.assuranceAt)].filter(Boolean).join(' · ')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Issue / remediation pairs, numbered. Scrolls past a cap so a long list does not stretch the
 * dialog. With `onRemove`, each row gets a delete button.
 */
function IssueList({ issues, onRemove }) {
  if (issues.length === 0) {
    return (
      <Box
        sx={{
          py: 2, textAlign: 'center', borderRadius: '10px',
          border: `1px solid ${tokens.hairline}`, color: tokens.muted, fontSize: '0.88rem',
        }}
      >
        No issues identified yet
      </Box>
    );
  }
  return (
    <Stack
      spacing={1}
      sx={{ maxHeight: 280, overflowY: 'auto', pr: 0.5 }}
      tabIndex={0}
      aria-label="Identified issues"
    >
      {issues.map((it, idx) => (
        <Stack
          // Position is the identity here: two findings can share wording.
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          direction="row"
          spacing={1.25}
          alignItems="flex-start"
          sx={{
            p: 1.5, borderRadius: '10px',
            backgroundColor: VERSIONS_BG, border: `1px solid ${tokens.hairline}`,
          }}
        >
          <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.75rem', color: tokens.muted, pt: 0.25 }}>
            {idx + 1}.
          </Typography>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, overflowWrap: 'anywhere' }}>
              {it.issue}
            </Typography>
            <Typography
              sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>Remediation: </Box>
              {it.remediation}
            </Typography>
          </Box>
          {onRemove && (
            <Tooltip title="Remove">
              <IconButton size="small" aria-label={`Remove issue ${idx + 1}`} onClick={() => onRemove(idx)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function VersionChip({ no }) {
  return (
    <Chip
      size="small"
      label={`v${no}`}
      variant="outlined"
      sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', height: 22 }}
    />
  );
}

function AssuranceChip({ status }) {
  const meta = ASSURANCE_META[status];
  return meta
    ? <Chip size="small" label={meta.label} color={meta.color} />
    : <Chip size="small" label="Not reviewed" variant="outlined" sx={{ color: tokens.muted }} />;
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
