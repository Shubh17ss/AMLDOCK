import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField,
} from '@mui/material';

const STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

export function DecideDialog({ open, mode, dealReference, onClose, onSubmit, submitting }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setNotes(''); setError(null); }
  }, [open]);

  const isApprove = mode === 'approve';
  const verb = isApprove ? 'Approve' : 'Reject';

  const submit = async (e) => {
    e.preventDefault();
    if (notes.trim().length < 3) {
      setError('Notes must be at least 3 characters');
      return;
    }
    try {
      await onSubmit(notes.trim());
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${verb.toLowerCase()}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{verb} {dealReference}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {isApprove
              ? 'Add notes describing what you verified. The broker and firm user will see these notes.'
              : 'Explain why this deal is being rejected. The broker and firm user will see these notes.'}
          </DialogContentText>
          <TextField
            autoFocus
            label="Decision notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={5}
            fullWidth
            required
            helperText={`${notes.length} characters`}
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained"
                  color={isApprove ? 'success' : 'error'}
                  disabled={submitting || notes.trim().length < 3}>
            {submitting ? `${verb.replace(/e$/, 'ing')}…` : verb}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export function OverrideDialog({ open, deal, onClose, onSubmit, submitting }) {
  const [targetStatus, setTargetStatus] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setTargetStatus('');
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!targetStatus) { setError('Pick a target status'); return; }
    if (targetStatus === deal?.status) { setError('Pick a different status'); return; }
    if (reason.trim().length < 3) { setError('Reason must be at least 3 characters'); return; }
    try {
      await onSubmit(targetStatus, reason.trim());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to override');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Override deal status</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Force this deal to a different status. The reason will be prefixed into the deal's
            decision notes for audit. Use sparingly — every override is logged.
          </DialogContentText>
          <Stack spacing={2}>
            <FormControl required>
              <InputLabel id="target-status-label">Target status</InputLabel>
              <Select labelId="target-status-label" label="Target status"
                      value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
                {STATUSES.filter((s) => s !== deal?.status).map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Reason" required multiline minRows={4}
                       value={reason} onChange={(e) => setReason(e.target.value)}
                       helperText={`${reason.length} characters`} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" color="warning"
                  disabled={submitting || !targetStatus || reason.trim().length < 3}>
            {submitting ? 'Applying…' : 'Apply override'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
