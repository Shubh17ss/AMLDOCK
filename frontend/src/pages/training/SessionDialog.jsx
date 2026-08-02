import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import {
  createTrainingSession, updateTrainingSession, listTrainingProviders,
} from '../../api/training.js';
import { UserMultiSelect } from '../../components/UserMultiSelect.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

const emptyForm = () => ({
  name: '',
  location: '',
  url: '',
  trainingProviderId: '',
  dueDate: '',
  totalMinutes: '',
  certifiedMinutes: '',
  assigneeUserIds: [],
});

/**
 * Create or edit a training session — one component, two modes, mounted twice by the parent
 * (the same shape as BranchDialog in features/firm/FirmBranchesCard.jsx). In edit mode `open`
 * is derived from the target row.
 */
export function SessionDialog({ mode, open: openProp, target, onClose }) {
  const isEdit = mode === 'edit';
  const open = isEdit ? Boolean(target) : openProp;

  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  const providersQ = useQuery({
    queryKey: ['trainingProviders', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingProviders({ firmId: firm?.id, branchId: branch?.id }),
    enabled: open,
  });
  const providers = providersQ.data ?? [];
  const noProviders = open && !providersQ.isLoading && providers.length === 0;

  // Prefill from the row in edit mode; start clean in create mode.
  useEffect(() => {
    if (isEdit && target) {
      setForm({
        name: target.name ?? '',
        location: target.location ?? '',
        url: target.url ?? '',
        trainingProviderId: target.trainingProviderId ?? '',
        dueDate: target.dueDate ?? '',
        totalMinutes: target.totalMinutes ?? '',
        certifiedMinutes: target.certifiedMinutes ?? '',
        assigneeUserIds: (target.attendees ?? []).map((a) => a.userId),
      });
      setError(null);
    }
    if (!isEdit && open) {
      setForm(emptyForm());
      setError(null);
    }
  }, [isEdit, isEdit ? target?.id : open]); // eslint-disable-line react-hooks/exhaustive-deps

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        url: form.url.trim(),
        trainingProviderId: form.trainingProviderId,
        dueDate: form.dueDate,
        totalMinutes: form.totalMinutes,
        certifiedMinutes: form.certifiedMinutes,
        assigneeUserIds: form.assigneeUserIds,
      };
      return isEdit
        ? updateTrainingSession(target.id, payload)
        : createTrainingSession({ ...payload, realEstateFirmId: firm?.id, firmBranchId: branch?.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingSessions'] });
      showToast({ severity: 'success', message: isEdit ? 'Session updated' : 'Session created' });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.message || 'Could not save the session. Try again.'),
  });

  const close = () => { if (!mut.isPending) onClose(); };

  const total = Number(form.totalMinutes);
  const certified = Number(form.certifiedMinutes);
  // Certified minutes are the share of the total that counts towards certification, so they
  // can never exceed it. The server enforces the same rule.
  const minutesInvalid = form.totalMinutes !== '' && form.certifiedMinutes !== '' && certified > total;

  const submittable = form.name.trim()
    && form.location.trim()
    && form.trainingProviderId
    && form.totalMinutes !== '' && total >= 0
    && form.certifiedMinutes !== '' && certified >= 0
    && !minutesInvalid;

  const submit = (e) => { e.preventDefault(); if (submittable) mut.mutate(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle>{isEdit ? 'Edit session' : 'New training session'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Session name"
              value={form.name}
              onChange={ch('name')}
              required
              fullWidth
            />
            <TextField
              label="Location"
              value={form.location}
              onChange={ch('location')}
              placeholder="Venue, or 'Online'"
              required
              fullWidth
            />
            <TextField
              label="URL"
              value={form.url}
              onChange={ch('url')}
              placeholder="Optional — link to the course or meeting"
              fullWidth
            />

            <FormControl fullWidth required disabled={noProviders}>
              <InputLabel id="provider-label">Provider</InputLabel>
              <Select
                labelId="provider-label"
                label="Provider"
                value={form.trainingProviderId}
                onChange={ch('trainingProviderId')}
              >
                {providers.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
              {noProviders && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                  This branch has no providers yet — add one on the <strong>Providers</strong> tab first.
                </Typography>
              )}
            </FormControl>

            <TextField
              label="Due"
              type="date"
              value={form.dueDate}
              onChange={ch('dueDate')}
              InputLabelProps={{ shrink: true }}
              helperText="Optional"
              fullWidth
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Total minutes"
                type="number"
                value={form.totalMinutes}
                onChange={ch('totalMinutes')}
                inputProps={{ min: 0, step: 1 }}
                required
                fullWidth
              />
              <TextField
                label="Certified minutes"
                type="number"
                value={form.certifiedMinutes}
                onChange={ch('certifiedMinutes')}
                inputProps={{ min: 0, step: 1 }}
                error={minutesInvalid}
                helperText={minutesInvalid ? 'Cannot exceed total minutes' : ' '}
                required
                fullWidth
              />
            </Stack>

            <UserMultiSelect
              value={form.assigneeUserIds}
              onChange={(ids) => setForm((f) => ({ ...f, assigneeUserIds: ids }))}
              firmId={firm?.id}
              branchId={branch?.id}
              helperText="Branch staff only — compliance officers and senior managers run training rather than attend it."
            />

            {isEdit && (
              <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>
                Removing someone clears their assignment. Anyone who stays keeps the completion
                already recorded against them.
              </Typography>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mut.isPending}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={isEdit ? <SaveIcon /> : <AddIcon />}
            disabled={mut.isPending || !submittable}
          >
            {mut.isPending ? 'Saving…' : (isEdit ? 'Save' : 'Create session')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
