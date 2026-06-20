import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { createUser } from '../api/users.js';
import { listBranches, listFirms } from '../api/firms.js';
import { creatableRoles, requiresFirm, requiresBranch, roleLabel } from '../auth/roles.js';

/**
 * Create-user dialog scoped to the logged-in user's privileges:
 *   - role options = roles they may create (strictly lower rank)
 *   - ROOT picks the firm; firm-level creators are pinned to their own firm
 *   - branch picker appears for branch roles; a sales manager's new users inherit their branch
 */
export function CreateUserDialog({ open, onClose, currentUser, lockedFirmId }) {
  const qc = useQueryClient();
  const creatorRole = currentUser?.role;
  const allowedRoles = creatableRoles(creatorRole);
  const isRoot = creatorRole === 'ROOT';
  const isSalesManager = creatorRole === 'SALES_MANAGER';
  // When a firm is locked (e.g. ROOT managing a specific firm) we don't show the firm picker.
  const firmPinned = lockedFirmId != null;
  const showFirmPicker = isRoot && !firmPinned;

  const emptyForm = () => ({
    email: '', fullName: '', role: allowedRoles[0] ?? '',
    realEstateFirmId: '', firmBranchId: '',
  });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setForm(emptyForm()); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const needsFirm = requiresFirm(form.role);
  const needsBranch = requiresBranch(form.role);

  const firmId = firmPinned ? lockedFirmId : (isRoot ? form.realEstateFirmId : currentUser?.realEstateFirmId);

  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms, enabled: showFirmPicker });
  const activeFirms = (firmsQ.data ?? []).filter((f) => f.active);

  const showBranchPicker = needsBranch && !isSalesManager;
  const branchesQ = useQuery({
    queryKey: ['firms', firmId, 'branches'],
    queryFn: () => listBranches(firmId),
    enabled: showBranchPicker && Boolean(firmId),
  });
  const activeBranches = (branchesQ.data ?? []).filter((b) => b.active);

  useEffect(() => {
    setForm((f) => ({ ...f, firmBranchId: '' }));
  }, [form.realEstateFirmId, form.role]);

  const resolvedBranchId = () => {
    if (!needsBranch) return null;
    if (isSalesManager) return currentUser?.firmBranchId ?? null;
    return form.firmBranchId ? Number(form.firmBranchId) : null;
  };

  const mut = useMutation({
    mutationFn: () => createUser({
      email: form.email,
      fullName: form.fullName,
      role: form.role,
      realEstateFirmId: needsFirm && firmId ? Number(firmId) : null,
      firmBranchId: resolvedBranchId(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm(emptyForm());
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create user'),
  });

  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submittable =
    form.email && form.fullName && form.role &&
    (!needsFirm || firmId) &&
    (!needsBranch || isSalesManager || form.firmBranchId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>New user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              New users sign in with their email and a one-time code — no password is set.
            </Typography>
            <TextField label="Full name" value={form.fullName} onChange={ch('fullName')} required />
            <TextField label="Email" type="email" value={form.email} onChange={ch('email')} required />
            <FormControl fullWidth required>
              <InputLabel id="role-label">Role</InputLabel>
              <Select labelId="role-label" label="Role" value={form.role} onChange={ch('role')}>
                {allowedRoles.map((r) => <MenuItem key={r} value={r}>{roleLabel(r)}</MenuItem>)}
              </Select>
            </FormControl>

            {showFirmPicker && needsFirm && (
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

            {showBranchPicker && (
              <FormControl fullWidth required disabled={!firmId}>
                <InputLabel id="branch-label">Branch</InputLabel>
                <Select labelId="branch-label" label="Branch"
                        value={form.firmBranchId}
                        onChange={ch('firmBranchId')}>
                  {activeBranches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                  ))}
                </Select>
                {firmId && activeBranches.length === 0 && !branchesQ.isLoading && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                    This firm has no active branches — add one under <strong>Firms</strong> first.
                  </Typography>
                )}
              </FormControl>
            )}

            {needsBranch && isSalesManager && (
              <Typography variant="caption" color="text.secondary">
                This user will be created in your branch.
              </Typography>
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
