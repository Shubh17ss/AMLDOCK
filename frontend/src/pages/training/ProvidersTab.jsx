import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { listTrainingProviders, deleteTrainingProvider } from '../../api/training.js';
import { AddProviderDialog } from './AddProviderDialog.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canDelete } from '../../auth/roles.js';
import { tokens } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/** AML Training › Providers — the organisations that deliver this branch's training. */
export function ProvidersTab({ addOpen, onCloseAdd }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [toDelete, setToDelete] = useState(null);
  const [search, setSearch] = useState('');

  const mayDelete = canDelete(user?.role);
  const colCount = mayDelete ? 4 : 3;

  const providersQ = useQuery({
    queryKey: ['trainingProviders', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingProviders({ firmId: firm?.id, branchId: branch?.id }),
  });
  const all = providersQ.data ?? [];
  const rows = useMemo(
    () => all.filter((p) => matchesSearch(search, p.name)),
    [all, search],
  );

  const deleteMut = useMutation({
    mutationFn: (p) => deleteTrainingProvider(p.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingProviders'] });
      showToast({ severity: 'success', message: 'Provider deleted' });
      setToDelete(null);
    },
    onError: (e) => {
      showToast({ severity: 'error', message: e.response?.data?.message || 'Delete failed. Try again.' });
    },
  });

  return (
    <Stack spacing={2}>
      {providersQ.isError && <Alert severity="error">Failed to load providers. Refresh to try again.</Alert>}

      <SearchField value={search} onChange={setSearch} placeholder="Search providers…" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Provider</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Added</TableCell>
              {mayDelete && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ color: tokens.ink, fontWeight: 600 }}>{p.name}</TableCell>
                <TableCell sx={{ color: p.email ? tokens.ink : tokens.muted }}>
                  {p.email || '—'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', color: tokens.muted }}>
                  {dateFmt(p.createdAt)}
                </TableCell>
                {mayDelete && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 56 }}>
                    <Tooltip title="Delete this provider">
                      <IconButton size="small" onClick={() => setToDelete(p)}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!providersQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 5, color: tokens.muted }}>
                  {search
                    ? `No providers match “${search}”.`
                    : 'No providers yet — add the first one to start scheduling sessions.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <AddProviderDialog open={Boolean(addOpen)} onClose={onCloseAdd} />

      <Dialog open={Boolean(toDelete)} onClose={() => !deleteMut.isPending && setToDelete(null)}
              maxWidth="xs" fullWidth>
        <DialogTitle>Delete this provider?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: tokens.ink }}>
            {toDelete && (
              <>Delete <Box component="span" sx={{ fontWeight: 700 }}>{toDelete.name}</Box> from this
              branch&apos;s provider list? Sessions already using them must be removed first.</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} disabled={deleteMut.isPending}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleteMut.isPending}
            onClick={() => deleteMut.mutate(toDelete)}
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
