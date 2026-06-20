import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteUser, listUsers, resetUserPassword, updateUser } from '../../api/users.js';
import { listBranches, listFirms } from '../../api/firms.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { creatableRoles, roleLabel } from '../../auth/roles.js';
import { CreateUserDialog } from '../../components/CreateUserDialog.jsx';

export function UsersAdminPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const firmsById = useMemo(() => {
    const map = new Map();
    (firmsQ.data ?? []).forEach((f) => map.set(f.id, f));
    return map;
  }, [firmsQ.data]);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => updateUser(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => window.alert(err.response?.data?.message || 'Failed to delete user'),
  });

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Users</Typography>
        {creatableRoles(currentUser?.role).length > 0 && (
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            + Add User
          </Button>
        )}
      </Stack>

      {usersQ.isError && <Alert severity="error">Failed to load users.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Firm</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usersQ.data?.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                canResetPassword={currentUser?.role === 'ROOT' && u.role === 'ROOT'}
                canDelete={currentUser?.role === 'ROOT' && u.role !== 'ROOT'}
                firmName={u.realEstateFirmId
                  ? (firmsById.get(u.realEstateFirmId)?.name ?? `#${u.realEstateFirmId}`)
                  : null}
                onToggleActive={(v) => updateMut.mutate({ id: u.id, payload: { active: v } })}
                onResetPassword={() => setResetTarget(u)}
                onDelete={() => {
                  if (window.confirm(`Delete ${u.email}? This cannot be undone.`)) deleteMut.mutate(u.id);
                }}
              />
            ))}
            {usersQ.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No users yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} currentUser={currentUser} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </Stack>
  );
}

/** Single row, lazily fetches the user's branch name when they have one. */
function UserRow({ user, firmName, canResetPassword, canDelete, onToggleActive, onResetPassword, onDelete }) {
  // Only brokers carry a branch; lazy-load just for those rows.
  const branchesQ = useQuery({
    queryKey: ['firms', user.realEstateFirmId, 'branches'],
    queryFn: () => listBranches(user.realEstateFirmId),
    enabled: Boolean(user.firmBranchId && user.realEstateFirmId),
  });
  const branchName = user.firmBranchId
    ? (branchesQ.data?.find((b) => b.id === user.firmBranchId)?.name ?? `#${user.firmBranchId}`)
    : null;

  return (
    <TableRow>
      <TableCell>{user.id}</TableCell>
      <TableCell>{user.fullName}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell><Chip size="small" label={roleLabel(user.role)} /></TableCell>
      <TableCell>{firmName ?? '—'}</TableCell>
      <TableCell>{branchName ?? '—'}</TableCell>
      <TableCell>
        <Switch checked={user.active} onChange={(e) => onToggleActive(e.target.checked)} />
      </TableCell>
      <TableCell align="right">
        {canResetPassword && (
          <Tooltip title="Reset password">
            <IconButton size="small" onClick={onResetPassword}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip title="Delete user">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

function ResetPasswordDialog({ target, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const open = Boolean(target);

  const mut = useMutation({
    mutationFn: () => resetUserPassword(target.id, newPassword),
    onSuccess: () => { setNewPassword(''); setError(null); onClose(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to reset password'),
  });

  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>For <strong>{target?.email}</strong></Typography>
            <TextField label="New password" type="password" value={newPassword}
                       onChange={(e) => setNewPassword(e.target.value)} required helperText="At least 8 characters" />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Reset'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
