import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
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
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens, fonts, motion } from '../../theme/theme.js';
import { formatDateTimeNumeric } from '../../utils/formatters.js';

const COLUMNS = 6;

/** The versions panel's background: a light grey in light mode, a lifted shade in dark. */
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
 * <p>One row per verified or closed deal, opening onto its signed-off versions, newest first.
 * Assurance is recorded on a version rather than the deal because a sign-off is per version: v2
 * can be assured while v3, written after a reopen, has not been looked at.
 *
 * <p>Scope is the server's, like every CDD register: the list arrives already narrowed to the
 * firm and branch the dashboard scope names, and to what the caller's role may read. The date
 * range narrows it further on the server, version by version — by when each was verified, and for
 * the version a deal stands on, by when the deal was closed.
 */
export function CddAssurancePage() {
  const { firm, branch } = useDashboardScope();
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fromAt = dayBound(from, false);
  const toAt = dayBound(to, true);

  const q = useQuery({
    queryKey: ['assurance', firm?.id ?? null, branch?.id ?? null, fromAt ?? null, toAt ?? null],
    queryFn: () => listAssurance({ firmId: firm?.id, branchId: branch?.id, from: fromAt, to: toAt }),
    // Keeps the table on screen while a new range loads, rather than flashing the skeleton.
    placeholderData: (prev) => prev,
  });

  const all = q.data ?? [];
  const rows = useMemo(
    () => all.filter(({ deal }) => matchesSearch(
      query, deal.propertyAddress, deal.reference, deal.clientDisplayName,
    )),
    [all, query],
  );

  const awaiting = all.filter(({ versions }) => versions[0] && !versions[0].assuranceStatus).length;
  const ranged = Boolean(from || to);
  const rangeInverted = Boolean(from && to && from > to);

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${rows.length} ${rows.length === 1 ? 'deal' : 'deals'} signed off`,
          awaiting > 0 ? `${awaiting} awaiting assurance` : null,
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
          onChange={setQuery}
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
        ? <SkeletonTable rows={6} columns={5} />
        : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Property</TableCell>
                  <TableCell>Last updated</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Versions</TableCell>
                  <TableCell>Latest version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <DealRow
                    key={r.deal.id}
                    deal={r.deal}
                    lastAssuredAt={r.lastAssuredAt}
                    versions={r.versions}
                  />
                ))}
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
          </TableContainer>
        )}
    </Stack>
  );
}

/** A deal, and — once opened — its signed-off versions under it. */
function DealRow({ deal, lastAssuredAt, versions }) {
  const [open, setOpen] = useState(false);
  const latest = versions[0];
  const label = deal.propertyAddress ?? deal.reference;
  const expandable = versions.length > 0;
  const toggle = () => setOpen((o) => !o);

  return (
    <>
      {/* The whole row toggles, since the chevron alone is a small target on a wide row. The
          chevron stays the control for the keyboard and screen readers; the row's own click is
          only a larger pointer target for the same action. */}
      <TableRow
        hover
        onClick={expandable ? toggle : undefined}
        sx={{
          cursor: expandable ? 'pointer' : 'default',
          '& > td': { borderBottom: open ? 'none' : undefined },
        }}
      >
        <TableCell>
          <IconButton
            size="small"
            aria-label={`${open ? 'Hide' : 'Show'} versions of ${label}`}
            aria-expanded={open}
            // Stopped here, or the row's own handler would toggle it straight back.
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            disabled={!expandable}
          >
            <KeyboardArrowDownIcon
              fontSize="small"
              sx={motion.respectful({
                transform: open ? 'rotate(180deg)' : 'none',
                transition: `transform ${motion.swift} ease`,
              })}
            />
          </IconButton>
        </TableCell>
        <TableCell>
          <Tooltip title={deal.propertyAddress ?? ''}>
            <Box
              component={RouterLink}
              to={`/deals/${deal.id}`}
              // Opening the deal is not expanding the row.
              onClick={(e) => e.stopPropagation()}
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
        {/* The latest assurance change across the deal's versions. */}
        <TableCell><Stamp at={lastAssuredAt} /></TableCell>
        <TableCell><DealStatusChip status={deal.status} /></TableCell>
        <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem' }}>{versions.length}</TableCell>
        <TableCell>
          {latest
            ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <VersionChip no={latest.versionNo} />
                <AssuranceChip status={latest.assuranceStatus} />
              </Stack>
            )
            // Verified before versions existed: nothing was frozen, so there is nothing to assure.
            : <Typography variant="caption" sx={{ color: tokens.muted }}>No signed-off version</Typography>}
        </TableCell>
      </TableRow>

      <TableRow>
        {/* A grey well under the deal, so its versions read as belonging to it rather than as
            more rows of the register. Mixed from the theme's own tokens so it flips with dark
            mode; --cl-hover would have been the obvious grey, but it is the row-hover colour. */}
        <TableCell
          colSpan={COLUMNS}
          sx={{
            p: 0,
            borderBottom: open ? undefined : 'none',
            backgroundColor: VERSIONS_BG,
          }}
        >
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: { xs: 1, sm: 7 }, py: 1.5 }}>
              <Table size="small" aria-label={`Versions of ${label}`}>
                <TableHead>
                  <TableRow
                    sx={{
                      // Transparent, or the theme's table-head tint paints a white strip across the well.
                      '& th': { color: tokens.muted, fontSize: '0.72rem', backgroundColor: 'transparent' },
                    }}
                  >
                    <TableCell>Version</TableCell>
                    <TableCell>Last updated</TableCell>
                    <TableCell>Assurance</TableCell>
                    <TableCell>Marked by</TableCell>
                    <TableCell align="right" sx={{ width: 56 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((v) => <VersionRow key={v.versionNo} deal={deal} version={v} />)}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function VersionRow({ deal, version: v }) {
  return (
    <TableRow sx={{ '&:last-child td': { borderBottom: 'none' } }}>
      <TableCell><VersionChip no={v.versionNo} /></TableCell>
      <TableCell><Stamp at={v.assuranceAt} /></TableCell>
      <TableCell>
        <AssuranceChip status={v.assuranceStatus} />
        {v.assuranceStatus === 'ACTION_REQUIRED' && v.issues?.length > 0 && (
          <Typography component="span" variant="caption" sx={{ ml: 1, color: tokens.muted }}>
            {v.issues.length} {v.issues.length === 1 ? 'issue' : 'issues'}
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ fontSize: '0.85rem', color: v.assuranceByName ? tokens.ink : tokens.muted }}>
        {v.assuranceStatus ? (v.assuranceByName ?? '—') : '—'}
      </TableCell>
      <TableCell align="right">
        <VersionMenu deal={deal} version={v} />
      </TableCell>
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
