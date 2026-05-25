import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { createUser, listUsers, resetUserPassword, updateUser } from '../../api/users.js';
import { listFirms } from '../../api/firms.js';

const ROLES = ['BROKER', 'COMPLIANCE', 'MANAGER', 'FIRM_USER'];

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
        <Button variant="contained" onClick={() => setCreateOpen(true)}>New user</Button>
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
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usersQ.data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Chip size="small" label={u.role} /></TableCell>
                <TableCell>
                  {u.realEstateFirmId
                    ? (firmsById.get(u.realEstateFirmId)?.name ?? `#${u.realEstateFirmId}`)
                    : '—'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={u.active}
                    onChange={(e) => updateMut.mutate({ id: u.id, payload: { active: e.target.checked } })}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Reset password">
                    <IconButton size="small" onClick={() => setResetTarget(u)}>
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {usersQ.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
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

function CreateUserDialog({ open, onClose }) {
  const qc = useQueryClient();
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const activeFirms = (firmsQ.data ?? []).filter((f) => f.active);
  const [form, setForm] = useState({ email: '', fullName: '', role: 'BROKER', password: '', realEstateFirmId: '' });
  const [error, setError] = useState(null);

  const mut = useMutation({
    mutationFn: () => createUser({
      email: form.email,
      fullName: form.fullName,
      role: form.role,
      password: form.password,
      realEstateFirmId: form.role === 'FIRM_USER' && form.realEstateFirmId ? Number(form.realEstateFirmId) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm({ email: '', fullName: '', role: 'BROKER', password: '', realEstateFirmId: '' });
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create user'),
  });

  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  const fieldChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>New user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full name" value={form.fullName} onChange={fieldChange('fullName')} required />
            <TextField label="Email" type="email" value={form.email} onChange={fieldChange('email')} required />
            <TextField label="Temporary password" type="password" value={form.password}
                       onChange={fieldChange('password')} required helperText="At least 8 characters" />
            <FormControl fullWidth>
              <InputLabel id="role-label">Role</InputLabel>
              <Select labelId="role-label" label="Role" value={form.role} onChange={fieldChange('role')}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
            {form.role === 'FIRM_USER' && (
              <FormControl fullWidth required>
                <InputLabel id="firm-label">Real-estate firm</InputLabel>
                <Select labelId="firm-label" label="Real-estate firm"
                        value={form.realEstateFirmId}
                        onChange={fieldChange('realEstateFirmId')}
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
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending}>
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
