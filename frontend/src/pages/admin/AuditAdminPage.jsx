import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Collapse, FormControl, IconButton, InputLabel, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import dayjs from 'dayjs';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, searchAudit } from '../../api/audit.js';
import { AuditActionChip } from '../../components/AuditActionChip.jsx';

const DEFAULT_FILTERS = {
  action: '',
  entityType: '',
  entityId: '',
  actorUserId: '',
  from: null,
  to: null,
};

export function AuditAdminPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
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
    keepPreviousData: true,
  });

  const ch = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const reset = () => { setFilters(DEFAULT_FILTERS); setPage(0); };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Audit log</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={reset}>Reset filters</Button>
          <Tooltip title="Refresh">
            <IconButton onClick={() => q.refetch()}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="action-label">Action</InputLabel>
            <Select labelId="action-label" label="Action" value={filters.action} onChange={ch('action')}>
              <MenuItem value=""><em>Any</em></MenuItem>
              {AUDIT_ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="entity-label">Entity type</InputLabel>
            <Select labelId="entity-label" label="Entity type" value={filters.entityType} onChange={ch('entityType')}>
              <MenuItem value=""><em>Any</em></MenuItem>
              {AUDIT_ENTITY_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Entity ID" type="number" value={filters.entityId} onChange={ch('entityId')} sx={{ width: 140 }} />
          <TextField size="small" label="Actor user ID" type="number" value={filters.actorUserId} onChange={ch('actorUserId')} sx={{ width: 140 }} />
          <DateTimePicker
            label="From"
            value={filters.from}
            onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
            slotProps={{ textField: { size: 'small', sx: { width: 220 } } }}
          />
          <DateTimePicker
            label="To"
            value={filters.to}
            onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
            slotProps={{ textField: { size: 'small', sx: { width: 220 } } }}
          />
        </Stack>
      </Paper>

      {q.isError && <Alert severity="error">Failed to load audit log.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={36} />
              <TableCell>Time (UTC)</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Summary</TableCell>
              <TableCell>IP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(q.data?.items ?? []).map((row) => <AuditRow key={row.id} row={row} />)}
            {!q.isLoading && (q.data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No audit entries match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={q.data?.totalElements ?? 0}
          page={page}
          rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPageOptions={[25, 50, 100, 200]}
          onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
        />
      </TableContainer>
    </Stack>
  );
}

function AuditRow({ row }) {
  const [open, setOpen] = useState(false);
  const hasMetadata = Boolean(row.metadata && row.metadata !== 'null');
  return (
    <>
      <TableRow hover>
        <TableCell>
          {hasMetadata && (
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>{new Date(row.createdAt).toISOString().replace('T', ' ').slice(0, 19)}</TableCell>
        <TableCell>{row.actorEmail ?? (row.actorUserId ? `#${row.actorUserId}` : 'system')}</TableCell>
        <TableCell><AuditActionChip action={row.action} /></TableCell>
        <TableCell>{row.entityType ? `${row.entityType} #${row.entityId ?? '—'}` : '—'}</TableCell>
        <TableCell sx={{ maxWidth: 380, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                   title={row.summary}>
          {row.summary}
        </TableCell>
        <TableCell>{row.ipAddress ?? '—'}</TableCell>
      </TableRow>
      {hasMetadata && (
        <TableRow>
          <TableCell colSpan={7} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
            <Collapse in={open} unmountOnExit>
              <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">Metadata</Typography>
                <Box component="pre" sx={{ m: 0, mt: 1, fontSize: 12, whiteSpace: 'pre-wrap' }}>
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
