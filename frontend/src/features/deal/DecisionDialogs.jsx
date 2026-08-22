import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField,
} from '@mui/material';

import { DEAL_STATUSES as STATUSES, dealStatusLabel } from '../../data/dealStatus.js';

/**
 * Asks for the note a status change needs, then runs it.
 *
 * One component for hold / verify / revert — they differ only in wording and button colour, and
 * every one of them writes a note to the deal's timeline. The 3-character floor matches the
 * server's (DealLifecycleService.requireNote) so the dialog fails fast rather than round-tripping.
 */
export function StatusNoteDialog({
  open, title, prompt, confirmLabel, confirmColor = 'primary',
  label = 'Note', onClose, onSubmit, submitting,
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setNote(''); setError(null); }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (note.trim().length < 3) { setError('Please write at least 3 characters'); return; }
    try {
      await onSubmit(note.trim());
    } catch (err) {
      setError(err.response?.data?.message || 'That didn’t go through. Try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {prompt && <DialogContentText sx={{ mb: 2 }}>{prompt}</DialogContentText>}
          <TextField
            autoFocus
            label={label}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            required
            helperText={`${note.length} characters`}
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" color={confirmColor}
                  disabled={submitting || note.trim().length < 3}>
            {submitting ? 'Working…' : confirmLabel}
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
            Force this deal to a different status, ignoring the normal order. The reason is
            written to the deal's timeline and the audit log. Use sparingly.
          </DialogContentText>
          <Stack spacing={2}>
            <FormControl required>
              <InputLabel id="target-status-label">Target status</InputLabel>
              <Select labelId="target-status-label" label="Target status"
                      value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
                {STATUSES.filter((s) => s !== deal?.status).map((s) => (
                  <MenuItem key={s} value={s}>{dealStatusLabel(s)}</MenuItem>
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
