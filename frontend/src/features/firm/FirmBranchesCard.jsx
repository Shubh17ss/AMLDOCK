import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { ActiveStatusChip } from './ActiveStatusChip.jsx';
import EditIcon from '@mui/icons-material/Edit';
import { createBranch, deactivateBranch, listBranches, updateBranch } from '../../api/firms.js';
import { tokens } from '../../theme/theme.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { emailFieldProps, isBadEmail } from '../../utils/email.js';

const EMPTY_BRANCH = {
  name: '', addressLine1: '', suburb: '', city: '', postcode: '',
  phone: '', managerName: '', managerEmail: '',
};

/**
 * Branches of a reporting entity with add / edit.
 *
 * `adminView` is ROOT's page: a read-only Status column and a ⋯ menu per branch (Edit, Deactivate,
 * Delete). Otherwise — the entity's own staff — there is no status column, and actions are Edit
 * plus, for senior managers (`canDeactivate`), the deactivate icon.
 *
 * `firmRef` is the reporting entity's public id. `maxBranches` is the count declared in the
 * reporting entity's details (set by ROOT) — adding beyond it is blocked here
 * and, authoritatively, by the API.
 */
export function FirmBranchesCard({ firmRef, canDeactivate = false, maxBranches = null, adminView = false }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const branchesQ = useQuery({
    queryKey: ['firms', firmRef, 'branches'],
    queryFn: () => listBranches(firmRef),
    enabled: Boolean(firmRef),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const activeCount = branchesQ.data?.filter((b) => b.active).length ?? 0;
  const atLimit = maxBranches != null && activeCount >= maxBranches;

  const deleteMut = useMutation({
    mutationFn: (branch) => deactivateBranch(branch.publicId),
    onSuccess: (_, branch) => {
      qc.invalidateQueries({ queryKey: ['firms', firmRef, 'branches'] });
      showToast({ severity: 'success', message: `${branch.name} deactivated` });
    },
    onError: (e) => showToast({ severity: 'error', message: e.response?.data?.message || 'That didn’t go through. Try again.' }),
  });

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="baseline">
            <Typography variant="h6">Branches</Typography>
            {maxBranches != null && (
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                {activeCount} of {maxBranches} declared
              </Typography>
            )}
          </Stack>
          <Tooltip title={atLimit ? `This reporting entity has ${maxBranches} branch(es). Deactivate one or ask ROOT to raise the count.` : ''}>
            <span>
              <Button variant="contained" disabled={atLimit} onClick={() => setCreateOpen(true)}>
                + Add branch
              </Button>
            </span>
          </Tooltip>
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
                {/* ROOT reads each branch's status; the entity's own staff do not see the column. */}
                {adminView && <TableCell>Status</TableCell>}
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
                  {adminView && <TableCell><ActiveStatusChip active={b.active} /></TableCell>}
                  <TableCell align="right">
                    {adminView ? (
                      <BranchActionsMenu branch={b} onEdit={() => setEditTarget(b)} />
                    ) : (<>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditTarget(b)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canDeactivate && (
                      <Tooltip title="Deactivate">
                        <IconButton size="small" color="error"
                                    onClick={() => deleteMut.mutate(b)} disabled={!b.active}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    </>)}
                  </TableCell>
                </TableRow>
              ))}
              {branchesQ.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={adminView ? 6 : 5} align="center" sx={{ py: 3, color: tokens.muted }}>
                    No branches yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <BranchDialog mode="create" firmRef={firmRef} open={createOpen} onClose={() => setCreateOpen(false)} />
      <BranchDialog mode="edit" firmRef={firmRef} branch={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

/**
 * ROOT's per-branch actions behind one ⋯ button. Edit opens the branch dialog; Deactivate and
 * Delete are placed now and wired up in the next phase.
 */
function BranchActionsMenu({ branch, onEdit }) {
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton size="small" aria-label={`Actions for ${branch.name}`}
                  onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => { close(); onEdit(); }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {/* Next phase: deactivate the branch. */}
        <MenuItem onClick={close}>
          {/* Amber: a step short of Delete's red — it can be undone. */}
          <ListItemIcon><BlockRoundedIcon fontSize="small" sx={{ color: tokens.review }} /></ListItemIcon>
          <ListItemText>Deactivate</ListItemText>
        </MenuItem>
        {/* Next phase: delete the branch. */}
        <MenuItem onClick={close} sx={{ color: tokens.rejected }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

function BranchDialog({ mode, firmRef, open: openProp, branch, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
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
    mutationFn: () => (isEdit ? updateBranch(branch.publicId, form) : createBranch(firmRef, form)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['firms', firmRef, 'branches'] });
      showToast({
        severity: 'success',
        message: isEdit ? `Branch ${saved?.name ?? form.name} updated` : `Branch ${saved?.name ?? form.name} added`,
      });
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
              <TextField label="Liaison email" type="email" value={form.managerEmail ?? ''} onChange={ch('managerEmail')} fullWidth required
                         {...emailFieldProps(form.managerEmail)} />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending || !form.name || !form.managerEmail || isBadEmail(form.managerEmail)}>
            {mut.isPending ? 'Saving…' : (isEdit ? 'Save' : 'Create')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
