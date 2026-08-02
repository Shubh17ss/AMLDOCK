import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { createTrainingProvider } from '../../api/training.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';

const emptyForm = () => ({ name: '', email: '' });

/** Adds a training provider to the branch currently selected in the sidebar. */
export function AddProviderDialog({ open, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError(null);
    }
  }, [open]);

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => createTrainingProvider({
      name: form.name.trim(),
      email: form.email.trim(),
      realEstateFirmId: firm?.id,
      firmBranchId: branch?.id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingProviders'] });
      showToast({ severity: 'success', message: 'Provider added' });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.message || 'Could not add the provider. Try again.'),
  });

  const close = () => { if (!mut.isPending) onClose(); };
  const submittable = Boolean(form.name.trim());
  const submit = (e) => { e.preventDefault(); if (submittable) mut.mutate(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Add provider</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Provider name"
              value={form.name}
              onChange={ch('name')}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={ch('email')}
              placeholder="Optional — contact address"
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mut.isPending}>Cancel</Button>
          <Button type="submit" variant="contained" startIcon={<AddIcon />}
                  disabled={mut.isPending || !submittable}>
            {mut.isPending ? 'Saving…' : 'Add provider'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
