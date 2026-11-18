import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Collapse, FormControl, IconButton, InputLabel, ListSubheader, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, searchAudit } from '../../api/audit.js';
import { AuditActionChip, auditActionLabel } from '../../components/AuditActionChip.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { tokens, fonts } from '../../theme/theme.js';

const DEFAULT_FILTERS = {
  action: '',
  entityType: '',
  entityId: '',
  actorUserId: '',
  from: null,
  to: null,
};

// The Action list is fifty entries long, so it is offered under the thing each action is about.
// Grouped by the stored value's prefix; anything unrecognised falls into "Other" rather than
// vanishing, so a new action added to AUDIT_ACTIONS still appears.
const ACTION_GROUPS = [
  ['Users', /^(USER|ROLE)_/],
  ['Deals', /^DEAL_/],
  ['Ownership', /^(NODE|EDGE|STRUCTURE)_/],
  ['Documents', /^(DOCUMENT|OCR)_/],
  ['Verification', /^VERIFICATION_/],
  ['Reporting entities', /^(FIRM|ENTITY_QUERY)_/],
  ['Branches', /^BRANCH_/],
];
const groupedActions = () => {
  const groups = ACTION_GROUPS.map(([label, re]) => [label, AUDIT_ACTIONS.filter((a) => re.test(a))]);
  const other = AUDIT_ACTIONS.filter((a) => !ACTION_GROUPS.some(([, re]) => re.test(a)));
  return [...groups, ['Other', other]].filter(([, items]) => items.length > 0);
};

/** `ComplianceDocument` → "Compliance document". */
const entityLabel = (t) => {
  const text = (t ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const dateFmt = (d) => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const timeFmt = (d) => d.toISOString().slice(11, 19);
const pickerFmt = (v) => v.format('D MMM YYYY, HH:mm');

export function AuditAdminPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);

  const params = {
    ...filters,
    from: filters.from?.isValid() ? filters.from.toISOString() : '',
    to: filters.to?.isValid() ? filters.to.toISOString() : '',
    page,
    size,
  };

  const q = useQuery({
    queryKey: ['audit', params],
    queryFn: () => searchAudit(params),
    // Keep the current rows on screen while the next page or filter loads, rather than
    // blanking the table. (`keepPreviousData: true` was the v4 spelling and did nothing here.)
    placeholderData: keepPreviousData,
  });

  // Any filter change starts again from the first page: page 4 of the old result is not a
  // meaningful place to be in the new one.
  const set = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0); };
  const ch = (k) => (e) => set(k, e.target.value);
  const reset = () => { setFilters(DEFAULT_FILTERS); setPage(0); };

  // What is narrowing the list right now, each removable on its own.
  const active = [
    filters.action && { key: 'action', label: auditActionLabel(filters.action), empty: '' },
    filters.entityType && { key: 'entityType', label: entityLabel(filters.entityType), empty: '' },
    filters.entityId && { key: 'entityId', label: `Record #${filters.entityId}`, empty: '' },
    filters.actorUserId && { key: 'actorUserId', label: `User #${filters.actorUserId}`, empty: '' },
    filters.from?.isValid() && { key: 'from', label: `From ${pickerFmt(filters.from)}`, empty: null },
    filters.to?.isValid() && { key: 'to', label: `To ${pickerFmt(filters.to)}`, empty: null },
  ].filter(Boolean);

  const total = q.data?.totalElements ?? 0;
  const rows = q.data?.items ?? [];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Audit log"
        subtitle={q.isLoading
          ? 'Loading…'
          : `${total.toLocaleString('en-NZ')} ${total === 1 ? 'event' : 'events'}${active.length ? ' match these filters' : ' recorded'}`}
        actions={
          <Tooltip title="Refresh">
            <IconButton onClick={() => q.refetch()} aria-label="Refresh"><RefreshIcon /></IconButton>
          </Tooltip>
        }
      />

      {/* Filters. The four most people reach for sit in one row; the two that need an id
          are tucked behind "More filters", and open on their own when one is in use. */}
      <Stack spacing={1.5}>
        <Box sx={{
          display: 'grid', gap: 1.5, alignItems: 'center',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto',
          },
        }}>
          <FormControl size="small" fullWidth>
            <InputLabel id="action-label">Action</InputLabel>
            <Select
              labelId="action-label" label="Action" value={filters.action} onChange={ch('action')}
              MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
            >
              <MenuItem value="">Any action</MenuItem>
              {groupedActions().flatMap(([label, items]) => [
                <ListSubheader key={label} sx={{ lineHeight: '32px', fontSize: '0.78rem', fontWeight: 600, color: tokens.muted }}>
                  {label}
                </ListSubheader>,
                ...items.map((a) => <MenuItem key={a} value={a}>{auditActionLabel(a)}</MenuItem>),
              ])}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="entity-label">Record type</InputLabel>
            <Select labelId="entity-label" label="Record type" value={filters.entityType} onChange={ch('entityType')}>
              <MenuItem value="">Any record</MenuItem>
              {AUDIT_ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{entityLabel(t)}</MenuItem>)}
            </Select>
          </FormControl>

          <DateTimePicker
            label="From"
            value={filters.from}
            onChange={(v) => set('from', v)}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />
          <DateTimePicker
            label="To"
            value={filters.to}
            onChange={(v) => set('to', v)}
            slotProps={{ textField: { size: 'small', fullWidth: true } }}
          />

          <Button
            variant="outlined"
            startIcon={<TuneRoundedIcon />}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            sx={{ whiteSpace: 'nowrap', justifySelf: { xs: 'start', lg: 'end' } }}
          >
            More filters
          </Button>
        </Box>

        <Collapse in={moreOpen || Boolean(filters.entityId || filters.actorUserId)} unmountOnExit>
          <Box sx={{
            display: 'grid', gap: 1.5,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 220px))' },
          }}>
            <TextField size="small" label="Record ID" type="number" value={filters.entityId} onChange={ch('entityId')}
                       helperText="The number after # in the Record column" />
            <TextField size="small" label="User ID" type="number" value={filters.actorUserId} onChange={ch('actorUserId')}
                       helperText="The ID shown in Settings, Users" />
          </Box>
        </Collapse>

        {active.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            {active.map((f) => (
              <Chip key={f.key} label={f.label} onDelete={() => set(f.key, f.empty)} color="primary" />
            ))}
            <Button size="small" onClick={reset}>Clear all</Button>
          </Box>
        )}
      </Stack>

      {q.isError && <Alert severity="error">Failed to load audit log.</Alert>}

      <TableContainer component={Paper}>
        {/* A floor on the width: on a phone the table scrolls sideways inside its frame instead
            of squeezing six columns into the screen. */}
        <Table size="small" sx={{ minWidth: 820, '& .MuiTableCell-root': { py: 1.25, verticalAlign: 'top' } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 150 }}>When (UTC)</TableCell>
              <TableCell sx={{ width: '22%' }}>Who</TableCell>
              <TableCell>What happened</TableCell>
              <TableCell sx={{ width: 190 }}>Record</TableCell>
              <TableCell sx={{ width: 130 }}>IP address</TableCell>
              <TableCell sx={{ width: 48 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => <AuditRow key={row.id} row={row} />)}
            {q.isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 5, color: tokens.muted }}>Loading…</TableCell>
              </TableRow>
            )}
            {!q.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography sx={{ color: tokens.ink, fontWeight: 600 }}>
                    {active.length ? 'Nothing matches these filters' : 'Nothing has been recorded yet'}
                  </Typography>
                  {active.length > 0 && (
                    <Button size="small" onClick={reset} sx={{ mt: 1 }}>Clear all filters</Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPageOptions={[25, 50, 100, 200]}
          onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
          sx={{ borderTop: `1px solid ${tokens.hairline}` }}
        />
      </TableContainer>
    </Stack>
  );
}

const MONO = { fontFamily: fonts.mono, fontSize: '0.78rem' };

function AuditRow({ row }) {
  const [open, setOpen] = useState(false);
  const hasMetadata = Boolean(row.metadata && row.metadata !== 'null');
  const at = new Date(row.createdAt);
  const actor = row.actorEmail ?? (row.actorUserId ? `User #${row.actorUserId}` : 'System');

  return (
    <>
      <TableRow hover sx={hasMetadata ? { '& > .MuiTableCell-root': { borderBottom: open ? 'none' : undefined } } : undefined}>
        <TableCell>
          <Typography sx={{ fontSize: '0.875rem', color: tokens.ink, whiteSpace: 'nowrap' }}>{dateFmt(at)}</Typography>
          <Typography sx={{ ...MONO, color: tokens.muted }}>{timeFmt(at)}</Typography>
        </TableCell>
        <TableCell sx={{ overflowWrap: 'anywhere', color: row.actorEmail ? tokens.ink : tokens.muted }}>
          {actor}
        </TableCell>
        <TableCell>
          <AuditActionChip action={row.action} />
          {row.summary && (
            <Typography sx={{ mt: 0.5, fontSize: '0.84rem', color: tokens.muted, wordBreak: 'break-word' }}>
              {row.summary}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          {row.entityType ? (
            <>
              <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>{entityLabel(row.entityType)}</Typography>
              <Typography sx={{ ...MONO, color: tokens.muted }}>#{row.entityId ?? '—'}</Typography>
            </>
          ) : '—'}
        </TableCell>
        <TableCell sx={{ ...MONO, color: tokens.muted, whiteSpace: 'nowrap' }}>{row.ipAddress ?? '—'}</TableCell>
        <TableCell align="right" sx={{ pr: 1 }}>
          {hasMetadata && (
            <Tooltip title={open ? 'Hide details' : 'Show details'}>
              <IconButton
                size="small"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? 'Hide details' : 'Show details'}
              >
                <KeyboardArrowDownIcon
                  fontSize="small"
                  sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>
      {hasMetadata && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: '0 !important', px: 2, borderBottom: open ? undefined : 'none' }}>
            <Collapse in={open} unmountOnExit>
              <Box sx={{ mb: 2, p: 2, borderRadius: '12px', backgroundColor: tokens.hover }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.muted }}>Details</Typography>
                <Box component="pre" sx={{ ...MONO, m: 0, mt: 1, color: tokens.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {prettyJson(row.metadata)}
                </Box>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function prettyJson(s) {
  if (!s) return '';
  try { return JSON.stringify(JSON.parse(s), null, 2); }
  catch { return s; }
}
