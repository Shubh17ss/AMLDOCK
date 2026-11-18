import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { raiseQuery } from '../../api/entityQueries.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

const MAX_MESSAGE = 4000;

/**
 * Asks the AMLDOCK admin team for a change to details this user may not edit themselves. Lands in
 * ROOT's Workspace › Queries, against the user's own entity, and every ROOT user is emailed.
 */
export function ContactAdminDialog({ open, onClose }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setMessage(''); setError(null); }
  }, [open]);

  const mut = useMutation({
    mutationFn: () => raiseQuery({ message: message.trim() }),
    onSuccess: () => {
      showToast({ severity: 'success', message: 'Sent to the AMLDOCK admin team' });
      onClose();
    },
    onError: (e) => setError(e.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  return (
    <Dialog open={open} onClose={mut.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Typography variant="h6" component="h2">Contact AMLDOCK admin</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
          Describe the change you need. The AMLDOCK admin team will be emailed and will follow up.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Describe the change"
            multiline
            minRows={5}
            fullWidth
            autoFocus
            value={message}
            onChange={(e) => { setMessage(e.target.value.slice(0, MAX_MESSAGE)); setError(null); }}
            helperText={`${message.length} / ${MAX_MESSAGE}`}
            slotProps={{ formHelperText: { sx: { textAlign: 'right' } } }}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={mut.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!message.trim() || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Sending…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
