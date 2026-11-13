import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { ActiveStatusChip } from './ActiveStatusChip.jsx';
import EditIcon from '@mui/icons-material/Edit';
import {
  activateBranch, createBranch, deactivateBranch, deleteBranch, getBranchDeletionPreview,
  listBranches, updateBranch,
} from '../../api/firms.js';
import { TypeToConfirmDialog } from '../../components/TypeToConfirmDialog.jsx';
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
 * `adminView` is ROOT's page: a Status column and a ⋯ menu per branch (Edit, Deactivate or
 * Reactivate, Delete). Off-boarding is ROOT's alone, so the entity's own staff get Edit only, and
 * no status column.
 *
 * `firmRef` is the reporting entity's public id. `maxBranches` is the count declared in the
 * reporting entity's details (set by ROOT) — adding beyond it is blocked here
 * and, authoritatively, by the API.
 */
export function FirmBranchesCard({ firmRef, firmActive = true, maxBranches = null, adminView = false }) {
  const branchesQ = useQuery({
    queryKey: ['firms', firmRef, 'branches'],
    queryFn: () => listBranches(firmRef),
    enabled: Boolean(firmRef),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeCount = branchesQ.data?.filter((b) => b.active).length ?? 0;
  const atLimit = maxBranches != null && activeCount >= maxBranches;

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
          <Tooltip title={!firmActive ? 'This reporting entity is deactivated.'
            : atLimit ? `This reporting entity has ${maxBranches} branch(es). Deactivate one or ask ROOT to raise the count.` : ''}>
            <span>
              <Button variant="contained" disabled={atLimit || !firmActive} onClick={() => setCreateOpen(true)}>
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
                  {adminView && (
                    <TableCell>
                      <ActiveStatusChip active={b.active} />
                      {!b.active && b.deactivatedAt && (
                        <Typography variant="caption" display="block" sx={{ color: tokens.muted, mt: 0.5 }}>
                          since {formatDate(b.deactivatedAt)}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    {adminView ? (
                      <BranchActionsMenu branch={b} onEdit={() => setEditTarget(b)}
                                         onToggleStatus={() => setStatusTarget(b)}
                                         onDelete={() => setDeleteTarget(b)} />
                    ) : (
                      <Tooltip title="Edit">
                        <IconButton size="small" disabled={!b.active} onClick={() => setEditTarget(b)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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
      <BranchStatusDialog firmRef={firmRef} branch={statusTarget} onClose={() => setStatusTarget(null)} />
      <DeleteBranchDialog firmRef={firmRef} branch={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </Card>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * ROOT's per-branch actions behind one ⋯ button. Edit opens the branch dialog; Deactivate or
 * Reactivate confirms first (BranchStatusDialog); Delete asks for the name (DeleteBranchDialog).
 */
function BranchActionsMenu({ branch, onEdit, onToggleStatus, onDelete }) {
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
        {/* A deactivated branch is held as it was: reactivate it to edit it. */}
        <MenuItem disabled={!branch.active} onClick={() => { close(); onEdit(); }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {branch.active ? (
          <MenuItem onClick={() => { close(); onToggleStatus(); }}>
            {/* Amber: a step short of Delete's red — it can be undone. */}
            <ListItemIcon><BlockRoundedIcon fontSize="small" sx={{ color: tokens.review }} /></ListItemIcon>
            <ListItemText>Deactivate</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { close(); onToggleStatus(); }}>
            <ListItemIcon><RestartAltRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Reactivate</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { close(); onDelete(); }} sx={{ color: tokens.rejected }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

/**
 * Confirms deactivating or reactivating a branch, saying what each does to the people in it.
 * Both touch users (their sessions and status), so the users list is refreshed too.
 */
function BranchStatusDialog({ firmRef, branch, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState(null);
  const deactivating = Boolean(branch?.active);

  useEffect(() => { setError(null); }, [branch?.id]);

  const mut = useMutation({
    mutationFn: () => (deactivating ? deactivateBranch(branch.publicId) : activateBranch(branch.publicId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms', firmRef, 'branches'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      showToast({ severity: 'success', message: `${branch.name} ${deactivating ? 'deactivated' : 'reactivated'}` });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  return (
    <Dialog open={Boolean(branch)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{deactivating ? `Deactivate ${branch?.name}?` : `Reactivate ${branch?.name}?`}</DialogTitle>
      <DialogContent>
        {deactivating ? (
          <Stack spacing={1.5}>
            <DialogContentText>
              Everyone who works in this branch is signed out and can no longer sign in.
            </DialogContentText>
            <DialogContentText>
              Compliance officers and senior managers keep read-only access. Nothing in the branch
              can be changed or deleted — not even by a platform administrator — until its
              retention period has passed.
            </DialogContentText>
            <DialogContentText>You can reactivate it later.</DialogContentText>
          </Stack>
        ) : (
          <DialogContentText>
            The branch becomes editable again, and the people its deactivation switched off can sign
            in again. Anyone a manager had deactivated themselves stays deactivated.
          </DialogContentText>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={deactivating ? 'warning' : 'primary'}
                disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Working…' : (deactivating ? 'Deactivate' : 'Reactivate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Deleting a branch. The server's preview decides what is offered: the retention date while a
 * deactivated branch is on hold, what stands in the way if anything outside would break, or else
 * what will go and the type-the-name confirmation.
 */
function DeleteBranchDialog({ firmRef, branch, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState(null);

  const previewQ = useQuery({
    queryKey: ['branches', branch?.publicId, 'deletion-preview'],
    queryFn: () => getBranchDeletionPreview(branch.publicId),
    enabled: Boolean(branch),
    // Always fresh: counts and eligibility move under it.
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => { setError(null); }, [branch?.id]);

  const mut = useMutation({
    mutationFn: (typed) => deleteBranch(branch.publicId, typed),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms', firmRef, 'branches'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      showToast({ severity: 'success', message: `${branch.name} deleted` });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  const p = previewQ.data;
  const summary = p && (
    <Box component="ul" sx={{ m: 0, pl: 2.5, color: tokens.muted }}>
      <li>{p.deals} deal(s) and {p.documents} document(s)</li>
      <li>{p.usersDeleted} user account(s) that belong only to this branch</li>
      {p.usersKept > 0 && (
        <li>{p.usersKept} user(s) who also belong to another reporting entity lose access here only</li>
      )}
      <li>The branch’s compliance, fund transaction, suspicious activity and training records</li>
    </Box>
  );

  return (
    <TypeToConfirmDialog
      open={Boolean(branch)}
      title={`Delete ${branch?.name ?? 'branch'}?`}
      name={branch?.name ?? ''}
      kind="branch"
      preview={p}
      loading={previewQ.isLoading}
      loadError={previewQ.isError ? (previewQ.error?.response?.data?.message || 'Couldn’t check this branch.') : null}
      summary={summary}
      error={error}
      pending={mut.isPending}
      onConfirm={(typed) => mut.mutate(typed)}
      onClose={onClose}
    />
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
