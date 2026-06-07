import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { createUser, listUsers, resetUserPassword, updateUser } from '../../api/users.js';
import { listBranches, listFirms } from '../../api/firms.js';



const ROLES = ['BROKER', 'COMPLIANCE', 'MANAGER', 'FIRM_USER'];

// Roles that need a firm linked. BROKER additionally needs a branch.
const FIRM_REQUIRED_ROLES = new Set(['BROKER', 'FIRM_USER']);
const BRANCH_REQUIRED_ROLES = new Set(['BROKER']);

export function UsersAdminPage() {
  const qc = useQueryClient();
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

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Users</Typography>
        <Button type="submit" variant="contained" onClick={() => setCreateOpen(true)}>
          + Add User
        </Button>
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
                firmName={u.realEstateFirmId
                  ? (firmsById.get(u.realEstateFirmId)?.name ?? `#${u.realEstateFirmId}`)
                  : null}
                onToggleActive={(v) => updateMut.mutate({ id: u.id, payload: { active: v } })}
                onResetPassword={() => setResetTarget(u)}
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

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />
    </Stack>
  );
}

/** Single row, lazily fetches the user's branch name when they have one. */
function UserRow({ user, firmName, onToggleActive, onResetPassword }) {
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
      <TableCell><Chip size="small" label={user.role} /></TableCell>
      <TableCell>{firmName ?? '—'}</TableCell>
      <TableCell>{branchName ?? '—'}</TableCell>
      <TableCell>
        <Switch checked={user.active} onChange={(e) => onToggleActive(e.target.checked)} />
      </TableCell>
      <TableCell align="right">
        <Tooltip title="Reset password">
          <IconButton size="small" onClick={onResetPassword}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

const EMPTY_FORM = {
  email: '', fullName: '', role: 'BROKER', password: '',
  realEstateFirmId: '', firmBranchId: '',
};

function CreateUserDialog({ open, onClose }) {
  const qc = useQueryClient();
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const activeFirms = (firmsQ.data ?? []).filter((f) => f.active);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  const needsFirm = FIRM_REQUIRED_ROLES.has(form.role);
  const needsBranch = BRANCH_REQUIRED_ROLES.has(form.role);

  // Branches list, only when we have a firm picked and we actually need a branch.
  const branchesQ = useQuery({
    queryKey: ['firms', form.realEstateFirmId, 'branches'],
    queryFn: () => listBranches(form.realEstateFirmId),
    enabled: needsBranch && Boolean(form.realEstateFirmId),
  });
  const activeBranches = (branchesQ.data ?? []).filter((b) => b.active);

  // Reset branch when the firm or role changes so we never carry a stale id.
  useEffect(() => {
    setForm((f) => ({ ...f, firmBranchId: '' }));
  }, [form.realEstateFirmId, form.role]);

  const mut = useMutation({
    mutationFn: () => createUser({
      email: form.email,
      fullName: form.fullName,
      role: form.role,
      password: form.password,
      realEstateFirmId: needsFirm && form.realEstateFirmId ? Number(form.realEstateFirmId) : null,
      firmBranchId: needsBranch && form.firmBranchId ? Number(form.firmBranchId) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm(EMPTY_FORM);
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create user'),
  });

  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submittable =
    form.email && form.fullName && form.password && form.role &&
    (!needsFirm || form.realEstateFirmId) &&
    (!needsBranch || form.firmBranchId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>New user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full name" value={form.fullName} onChange={ch('fullName')} required />
            <TextField label="Email" type="email" value={form.email} onChange={ch('email')} required />
            <TextField label="Temporary password" type="password" value={form.password}
                       onChange={ch('password')} required helperText="At least 8 characters" />
            <FormControl fullWidth>
              <InputLabel id="role-label">Role</InputLabel>
              <Select labelId="role-label" label="Role" value={form.role} onChange={ch('role')}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>

            {needsFirm && (
              <FormControl fullWidth required>
                <InputLabel id="firm-label">Real-estate firm</InputLabel>
                <Select labelId="firm-label" label="Real-estate firm"
                        value={form.realEstateFirmId}
                        onChange={ch('realEstateFirmId')}
                        disabled={activeFirms.length === 0}>
                  {activeFirms.map((f) => (
                    <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                  ))}
                </Select>
                {activeFirms.length === 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                    No active firms — create one under <strong>Firms</strong> first.
                  </Typography>
                )}
              </FormControl>
            )}

            {needsBranch && (
              <FormControl fullWidth required disabled={!form.realEstateFirmId}>
                <InputLabel id="branch-label">Branch</InputLabel>
                <Select labelId="branch-label" label="Branch"
                        value={form.firmBranchId}
                        onChange={ch('firmBranchId')}>
                  {activeBranches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                  ))}
                </Select>
                {form.realEstateFirmId && activeBranches.length === 0 && !branchesQ.isLoading && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                    This firm has no active branches — add one under <strong>Firms</strong> first.
                  </Typography>
                )}
              </FormControl>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending || !submittable}>
            {mut.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
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
