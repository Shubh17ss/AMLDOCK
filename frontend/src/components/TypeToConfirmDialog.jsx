import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField, Typography,
} from '@mui/material';
import { tokens } from '../theme/theme.js';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The confirmation for an irreversible delete of something with a name (a branch, a reporting
 * entity). The red button stays disabled until the name is typed exactly — the same comparison
 * the server makes — so a stray click or a mixed-up row cannot delete the wrong thing.
 *
 * `preview` is the server's deletion preview: `eligible` / `eligibleAt` say whether the retention
 * hold allows it yet, `blockers` lists anything outside that deleting would break. Either one
 * replaces the name field with the reason, since there is nothing to confirm.
 *
 * `onConfirm` receives the typed text, which the caller sends as the confirmation: the server
 * checks what was typed, not what the page already knew.
 */
export function TypeToConfirmDialog({
  open, title, name, kind, preview, loading, loadError, summary, error, pending, onConfirm, onClose,
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => { if (open) setTyped(''); }, [open, name]);

  const onHold = preview && !preview.eligible;
  const blocked = preview?.blockers?.length > 0;
  const canConfirm = preview && !onHold && !blocked && typed.trim() === name && !pending;

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: tokens.rejected }}>{title}</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
        )}
        {loadError && <Alert severity="error">{loadError}</Alert>}
        {preview && (
          <Stack spacing={2}>
            {onHold && (
              <Alert severity="info">
                This {kind} is deactivated and within its retention period. It can be deleted
                from <strong>{formatDate(preview.eligibleAt)}</strong>.
              </Alert>
            )}
            {!onHold && blocked && (
              <Alert severity="warning">
                This {kind} can’t be deleted, because doing so would break records outside it:
                <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
                  {preview.blockers.map((b) => <li key={b}>{b}</li>)}
                </Box>
              </Alert>
            )}
            {!onHold && !blocked && (
              <>
                <Alert severity="error" variant="outlined">
                  <strong>This cannot be undone.</strong> Everything in this {kind} is permanently
                  deleted, including its stored files.
                </Alert>
                {summary}
                <Typography variant="body2">
                  Type <strong>{name}</strong> to confirm.
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={name}
                  inputProps={{ 'aria-label': `Type ${name} to confirm` }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) onConfirm(typed.trim()); }}
                />
              </>
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" color="error" disabled={!canConfirm} onClick={() => onConfirm(typed.trim())}>
          {pending ? 'Deleting…' : `Delete ${kind}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
