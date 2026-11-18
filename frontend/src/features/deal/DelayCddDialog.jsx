import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { tokens } from '../../theme/theme.js';

/** Asks before flagging CDD on this transaction as delayed. */
export function DelayCddDialog({ open, submitting = false, onConfirm, onClose }) {
  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Delay CDD</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.95rem', color: tokens.ink }}>
          Do you want to delay CDD on this transaction?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>No</Button>
        <Button variant="contained" color="primary" onClick={onConfirm} disabled={submitting}>
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
