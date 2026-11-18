import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteQuery, listQueries, resolveQuery } from '../../api/entityQueries.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';
import { formatDateTime } from '../../utils/formatters.js';

const FILTERS = { OPEN: 'Open', RESOLVED: 'Resolved', ALL: 'All' };

/**
 * Workspace › Queries (ROOT). Change requests raised from Settings › Reporting Entity, newest
 * first: who asked, for which entity, and what. Resolving marks one done; deleting
 * removes it from the database, with only the audit entry left behind.
 */
export function QueriesAdminPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('OPEN');
  const [deleting, setDeleting] = useState(null);
  const queriesQ = useQuery({ queryKey: ['entity-queries'], queryFn: listQueries });

  const all = queriesQ.data ?? [];
  const openCount = all.filter((q) => q.status === 'OPEN').length;
  const rows = filter === 'ALL' ? all : all.filter((q) => q.status === filter);

  const refresh = () => qc.invalidateQueries({ queryKey: ['entity-queries'] });
  const fail = (e) => showToast({ severity: 'error', message: e.response?.data?.message || 'That didn’t go through. Try again.' });

  const resolveMut = useMutation({
    mutationFn: (id) => resolveQuery(id),
    onSuccess: () => { showToast({ severity: 'success', message: 'Marked as resolved' }); refresh(); },
    onError: fail,
  });
  const deleteMut = useMutation({
    mutationFn: (id) => deleteQuery(id),
    onSuccess: () => { showToast({ severity: 'success', message: 'Query deleted' }); setDeleting(null); refresh(); },
    onError: fail,
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={`${openCount} open · ${all.length} total`}
        title="Queries"
        actions={(
          <ToggleButtonGroup size="small" exclusive value={filter}
                             onChange={(_, v) => v && setFilter(v)}>
            {Object.entries(FILTERS).map(([k, label]) => (
              <ToggleButton key={k} value={k} sx={{ px: 2 }}>{label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      />

      {queriesQ.isError && <Alert severity="error">Failed to load queries.</Alert>}
      {queriesQ.isSuccess && rows.length === 0 && (
        <Alert severity="info">
          {filter === 'OPEN' ? 'No open queries.' : 'No queries to show.'}
        </Alert>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Raised</TableCell>
                <TableCell>Reporting entity</TableCell>
                <TableCell>Raised by</TableCell>
                <TableCell sx={{ minWidth: 280 }}>Query</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((q) => (
                <TableRow key={q.id} hover sx={{ verticalAlign: 'top' }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(q.createdAt)}</TableCell>
                  <TableCell>
                    {q.realEstateFirmPublicId
                      ? <Link component={RouterLink} to={`/settings/reporting-entities/${q.realEstateFirmPublicId}`}>
                          {q.realEstateFirmName}
                        </Link>
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{q.raisedByName || '—'}</Typography>
                    <Typography variant="caption" sx={{ color: tokens.muted, overflowWrap: 'anywhere' }}>
                      {q.raisedByEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {q.message}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {q.status === 'RESOLVED'
                      ? <Chip size="small" color="success" variant="outlined" label="Resolved" />
                      : <Chip size="small" color="warning" variant="outlined" label="Open" />}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {q.status === 'OPEN' && (
                      <Button size="small" startIcon={<CheckCircleOutlineIcon />}
                              disabled={resolveMut.isPending} onClick={() => resolveMut.mutate(q.id)}>
                        Mark resolved
                      </Button>
                    )}
                    <Button size="small" color="error" startIcon={<DeleteOutlineIcon />}
                            onClick={() => setDeleting(q)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(deleting)} onClose={deleteMut.isPending ? undefined : () => setDeleting(null)}
              maxWidth="xs" fullWidth>
        <DialogTitle>Delete this query?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            The query from {deleting?.raisedByEmail} will be removed permanently.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleting(null)} disabled={deleteMut.isPending}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(deleting.id)}>
            {deleteMut.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
