import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Badge, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import {
  createTrainingSession, updateTrainingSession, listTrainingProviders,
} from '../../api/training.js';
import { AssigneePicker } from '../../components/AssigneePicker.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

const emptyForm = () => ({
  name: '',
  description: '',
  location: '',
  url: '',
  trainingProviderId: '',
  sessionDate: '',
  totalMinutes: '',
  assigneeUserIds: [],
});

/**
 * Panels all stay mounted with the inactive one hidden, so switching tabs never loses what's
 * been typed — the same arrangement as CourseDialog.
 */
const panelSx = (active) => (active ? {} : { display: 'none' });

/**
 * Create or edit a training session across two tabs: Details and Users.
 * One component, two modes, mounted twice by the parent.
 */
export function SessionDialog({ mode, open: openProp, target, onClose }) {
  const isEdit = mode === 'edit';
  const open = isEdit ? Boolean(target) : openProp;

  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const [tab, setTab] = useState('details');
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
        description: target.description ?? '',
        location: target.location ?? '',
        url: target.url ?? '',
        trainingProviderId: target.trainingProviderId ?? '',
        sessionDate: target.sessionDate ?? '',
        totalMinutes: target.totalMinutes ?? '',
        assigneeUserIds: (target.attendees ?? []).map((a) => a.userId),
      });
      setTab('details');
      setError(null);
    }
    if (!isEdit && open) {
      setForm(emptyForm());
      setTab('details');
      setError(null);
    }
  }, [isEdit, isEdit ? target?.id : open]); // eslint-disable-line react-hooks/exhaustive-deps

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        url: form.url.trim(),
        trainingProviderId: form.trainingProviderId,
        sessionDate: form.sessionDate,
        totalMinutes: form.totalMinutes,
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

  const submittable = form.name.trim()
    && form.location.trim()
    && form.trainingProviderId
    && form.sessionDate
    && form.totalMinutes !== '' && total >= 0;

  const submit = (e) => {
    e.preventDefault();
    if (submittable) { mut.mutate(); return; }
    // Everything that can be missing lives on Details — show it rather than leaving the user
    // staring at an inert button on Users.
    setTab('details');
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      {/* noValidate: the inactive panel stays mounted, and the browser refuses to submit a form
          containing a hidden required control. `submittable` is the real gate. */}
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle sx={{ pb: 1 }}>{isEdit ? 'Edit session' : 'New training session'}</DialogTitle>

        <Box sx={{ px: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Details" value="details" />
            <Tab
              value="users"
              label={(
                <Badge color="primary" badgeContent={form.assigneeUserIds.length}
                       sx={{ '& .MuiBadge-badge': { right: -12, top: 2 } }}>
                  Users
                </Badge>
              )}
            />
          </Tabs>
        </Box>

        <DialogContent sx={{ minHeight: 380 }}>
          <Box sx={panelSx(tab === 'details')}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Session name"
                value={form.name}
                onChange={ch('name')}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={ch('description')}
                placeholder="Optional — what the session covers"
                multiline
                minRows={3}
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

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Date"
                  type="date"
                  value={form.sessionDate}
                  onChange={ch('sessionDate')}
                  InputLabelProps={{ shrink: true }}
                  helperText="The day the session runs"
                  required
                  fullWidth
                />
                <TextField
                  label="Total minutes"
                  type="number"
                  value={form.totalMinutes}
                  onChange={ch('totalMinutes')}
                  inputProps={{ min: 0, step: 1 }}
                  helperText=" "
                  required
                  fullWidth
                />
              </Stack>
            </Stack>
          </Box>

          <Box sx={panelSx(tab === 'users')}>
            <Box sx={{ mt: 1 }}>
              <AssigneePicker
                value={form.assigneeUserIds}
                onChange={(ids) => setForm((f) => ({ ...f, assigneeUserIds: ids }))}
                firmId={firm?.id}
                branchId={branch?.id}
                branchName={branch?.name}
              />
              {isEdit && (
                <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 1.5 }}>
                  Unticking someone clears their assignment. Anyone who stays keeps the completion
                  already recorded against them.
                </Typography>
              )}
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
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
