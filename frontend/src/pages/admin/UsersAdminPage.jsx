import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteUser, listUsers, resetUserPassword, updateUser } from '../../api/users.js';
import { listBranches, listFirms } from '../../api/firms.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { creatableRoles, isFirmLevel, roleLabel } from '../../auth/roles.js';
import { CreateUserDialog } from '../../components/CreateUserDialog.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { InstantSwitch } from '../../components/InstantSwitch.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import AddIcon from '@mui/icons-material/PersonAddAlt1';
import { tokens } from '../../theme/theme.js';

export function UsersAdminPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  // The Users list follows the firm/branch selected in the sidebar scope selector.
  const { firm, branch } = useDashboardScope();
  const usersQ = useQuery({
    queryKey: ['users', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listUsers({ firmId: firm?.id, branchId: branch?.id }),
  });
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const firmsById = useMemo(() => {
    const map = new Map();
    (firmsQ.data ?? []).forEach((f) => map.set(f.id, f));
    return map;
  }, [firmsQ.data]);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [search, setSearch] = useState('');

  // Filtered client-side: the list is already narrowed to the actor's tier and the selected
  // scope, so it's small enough that a round trip per keystroke would buy nothing. Searching
  // the role label as well as the raw value means "auditor" finds an AUDIT user.
  const rows = useMemo(
    () => (usersQ.data ?? []).filter(
      (u) => matchesSearch(search, u.fullName, u.email, u.role, roleLabel(u.role)),
    ),
    [usersQ.data, search],
  );

  // The API already scopes the list (ROOT: everyone, firm-level: their own entity). These
  // mirror UserService.assertCanManage so we don't offer controls the API will reject.
  const isRoot = currentUser?.role === 'ROOT';
  const canManage = (u) => (isRoot
    ? u.role !== 'ROOT'
    : isFirmLevel(currentUser?.role) && !isFirmLevel(u.role));

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => updateUser(id, payload),
  });

  /**
   * Suspend or restore an account.
   *
   * Awaits the invalidation as well as the PATCH, because InstantSwitch drops its optimistic
   * position the moment this settles — returning before the list has refetched would hand the
   * switch back a value it is about to replace, and the thumb would flick twice.
   */
  const toggleActive = async (id, active) => {
    try {
      await updateMut.mutateAsync({ id, payload: { active } });
      await qc.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      // Matching the delete handler on this page. The switch returns to the server's value on its
      // own; this says why, which "it sprang back" alone does not.
      window.alert(err.response?.data?.message || 'Could not change this account’s status');
      throw err;
    }
  };
  const deleteMut = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => window.alert(err.response?.data?.message || 'Failed to delete user'),
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={[
          search
            ? `${rows.length} of ${usersQ.data?.length ?? 0} users`
            : `${usersQ.data?.length ?? 0} users`,
          firm?.name ?? (isRoot ? 'all reporting entities' : 'your reporting entity'),
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Users"
        actions={creatableRoles(currentUser?.role).length > 0 && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Add user
          </Button>
        )}
      />

      {usersQ.isError && <Alert severity="error">Failed to load users.</Alert>}

      <SearchField value={search} onChange={setSearch} placeholder="Search name, email or role…" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Reporting entity</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                canResetPassword={isRoot && u.role === 'ROOT'}
                canDelete={canManage(u)}
                // Mirrors the server: whoever may manage a user may suspend them, and nobody may
                // suspend themselves (UserService.update refuses it — a firm whose only compliance
                // officer switched their own account off would have nobody left to switch it on).
                canToggleActive={canManage(u) && u.id !== currentUser?.userId}
                firmName={u.realEstateFirmId
                  ? (firmsById.get(u.realEstateFirmId)?.name ?? `#${u.realEstateFirmId}`)
                  : null}
                onToggleActive={(v) => toggleActive(u.id, v)}
                onResetPassword={() => setResetTarget(u)}
                onDelete={() => {
                  if (window.confirm(`Delete ${u.email}? This cannot be undone.`)) deleteMut.mutate(u.id);
                }}
              />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: tokens.muted }}>
                  {search ? `No users match “${search}”.` : 'No users yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} currentUser={currentUser}
                        lockedFirm={firm} lockedBranch={branch} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </Stack>
  );
}

/** Single row, lazily fetches the user's branch name when they have one. */
function UserRow({ user, firmName, canResetPassword, canDelete, canToggleActive,
                   onToggleActive, onResetPassword, onDelete }) {
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
        {/* Read-only rather than silently inert for anyone the API would refuse — and it does
            still refuse: this only decides whether to offer the control. */}
        <InstantSwitch checked={user.active} disabled={!canToggleActive} onToggle={onToggleActive} />
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
