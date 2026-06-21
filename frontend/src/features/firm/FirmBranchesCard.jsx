import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { createBranch, deactivateBranch, listBranches, updateBranch } from '../../api/firms.js';

const EMPTY_BRANCH = {
  name: '', addressLine1: '', suburb: '', city: '', postcode: '',
  phone: '', managerName: '', managerEmail: '',
};

/** Branches of a firm with add / edit, and (for ROOT / senior managers) deactivate. */
export function FirmBranchesCard({ firmId, canDeactivate = false }) {
  const qc = useQueryClient();
  const branchesQ = useQuery({
    queryKey: ['firms', firmId, 'branches'],
    queryFn: () => listBranches(firmId),
    enabled: Boolean(firmId),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => updateBranch(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'branches'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => deactivateBranch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firmId, 'branches'] }),
    onError: (err) => window.alert(err.response?.data?.message || 'Failed to deactivate branch'),
  });

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">Branches</Typography>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>+ Add branch</Button>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Liaison</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branchesQ.data?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.city ?? '—'}</TableCell>
                  <TableCell>{b.managerName ?? '—'}</TableCell>
                  <TableCell>{b.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Switch size="small" checked={b.active}
                            disabled={!canDeactivate}
                            onChange={(e) => toggleActive.mutate({ id: b.id, active: e.target.checked })} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditTarget(b)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canDeactivate && (
                      <Tooltip title="Deactivate">
                        <IconButton size="small" color="error"
                                    onClick={() => deleteMut.mutate(b.id)} disabled={!b.active}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {branchesQ.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No branches yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <BranchDialog mode="create" firmId={firmId} open={createOpen} onClose={() => setCreateOpen(false)} />
      <BranchDialog mode="edit" firmId={firmId} branch={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

function BranchDialog({ mode, firmId, open: openProp, branch, onClose }) {
  const qc = useQueryClient();
  const isEdit = mode === 'edit';
  const open = isEdit ? Boolean(branch) : openProp;
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit && branch) setForm({ ...EMPTY_BRANCH, ...branch });
    if (!isEdit && open) setForm(EMPTY_BRANCH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit ? branch?.id : open]);

  const mut = useMutation({
    mutationFn: () => (isEdit ? updateBranch(branch.id, form) : createBranch(firmId, form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms', firmId, 'branches'] });
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to save branch'),
  });

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{isEdit ? 'Edit branch' : 'New branch'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Branch name" value={form.name ?? ''} onChange={ch('name')} required />
            <TextField label="Address line 1" value={form.addressLine1 ?? ''} onChange={ch('addressLine1')} />
            <Stack direction="row" spacing={2}>
              <TextField label="Suburb" value={form.suburb ?? ''} onChange={ch('suburb')} fullWidth />
              <TextField label="City" value={form.city ?? ''} onChange={ch('city')} fullWidth />
            </Stack>
            <TextField label="Postcode" value={form.postcode ?? ''} onChange={ch('postcode')} fullWidth />
            <TextField label="Phone" value={form.phone ?? ''} onChange={ch('phone')} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label="Liaison name" value={form.managerName ?? ''} onChange={ch('managerName')} fullWidth />
              <TextField label="Liaison email" type="email" value={form.managerEmail ?? ''} onChange={ch('managerEmail')} fullWidth required />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending || !form.name || !form.managerEmail}>
            {mut.isPending ? 'Saving…' : (isEdit ? 'Save' : 'Create')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
