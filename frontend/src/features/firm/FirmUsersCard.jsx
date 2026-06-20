import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteUser, listUsers, updateUser } from '../../api/users.js';
import { roleLabel } from '../../auth/roles.js';
import { CreateUserDialog } from '../../components/CreateUserDialog.jsx';

// Firm-level peers can't be edited or deleted from a firm view (matches the backend rule).
const PROTECTED_ROLES = new Set(['SENIOR_MANAGER', 'AML_COMPLIANCE_OFFICER']);

/**
 * Users belonging to a single firm, with add / edit (name+email) / delete.
 * Scoped by `firmId`; ROOT may manage any firm, firm-level/sales-manager are pinned server-side.
 */
export function FirmUsersCard({ firmId, currentUser, title = 'Firm users' }) {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const rows = (usersQ.data ?? []).filter((u) => u.realEstateFirmId === firmId);

  // ROOT may manage every user in a firm (any role). Firm-level managers can't touch their
  // senior-manager / compliance peers or their own account; a sales manager can't touch peers.
  const isProtected = (u) => {
    if (currentUser?.role === 'ROOT') return false;
    if (PROTECTED_ROLES.has(u.role)) return true;
    if (u.id === currentUser?.userId) return true;
    if (currentUser?.role === 'SALES_MANAGER' && u.role === 'SALES_MANAGER') return true;
    return false;
  };

  const deleteMut = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => window.alert(err.response?.data?.message || 'Failed to delete user'),
  });

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>+ Add user</Button>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        {usersQ.isError && <Alert severity="error">Failed to load users.</Alert>}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((u) => {
                const protectedRow = isProtected(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Chip size="small" label={roleLabel(u.role)} /></TableCell>
                    <TableCell align="right">
                      {protectedRow ? (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      ) : (
                        <>
                          <Tooltip title="Edit name / email">
                            <IconButton size="small" onClick={() => setEditTarget(u)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete user">
                            <IconButton size="small" color="error"
                              onClick={() => {
                                if (window.confirm(`Delete ${u.email}? This cannot be undone.`)) deleteMut.mutate(u.id);
                              }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        currentUser={currentUser}
        lockedFirmId={firmId}
      />
      <EditUserDialog target={editTarget} onClose={() => setEditTarget(null)} />
    </Card>
  );
}

function EditUserDialog({ target, onClose }) {
  const qc = useQueryClient();
  const open = Boolean(target);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (target) setForm({ fullName: target.fullName ?? '', email: target.email ?? '' });
  }, [target?.id]);

  const mut = useMutation({
    mutationFn: () => updateUser(target.id, { fullName: form.fullName, email: form.email }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setError(null); onClose(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update user'),
  });

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full name" value={form.fullName} onChange={ch('fullName')} required />
            <TextField label="Email" type="email" value={form.email} onChange={ch('email')} required />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending || !form.fullName || !form.email}>
            {mut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
