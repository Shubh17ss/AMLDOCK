import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteDeal } from '../../api/deals.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

/**
 * Confirms destroying a deal and everything filed against it.
 *
 * <p>The list is the point. A row on a register shows an address and a status, which is nothing
 * like the whole of what a deal holds — the client record, the ownership structure, every
 * document uploaded against it and every version signed off. Deleting used to be reachable only
 * from inside the create form, where the author could see how little was there; from a register
 * it needs saying out loud.
 *
 * <p>The server is stricter than the menu that opened this. A compliance officer or senior
 * manager may only delete within their own firm, and the browser cannot check that from a list
 * row — so a refusal arrives here as the error below rather than being prevented.
 */
export function DeleteDealDialog({ open, deal, onClose, onDeleted }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState(null);

  const mut = useMutation({
    mutationFn: () => deleteDeal(deal.id),
    onSuccess: () => {
      // The prefix, so the register, the queues and the dashboards all drop the row together.
      qc.invalidateQueries({ queryKey: ['deals'] });
      showToast({ severity: 'success', message: 'Deal deleted' });
      onDeleted?.();
    },
    onError: (e) => setError(e.response?.data?.message || 'Could not delete this deal. Try again.'),
  });

  const label = deal?.propertyAddress ?? deal?.reference ?? `deal #${deal?.id}`;

  return (
    <Dialog
      open={open}
      // Closing mid-delete would leave the reviewer unsure whether it happened.
      onClose={mut.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Delete {label}?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          This removes the whole file, not just the listing:
        </Typography>
        <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5, color: tokens.muted }}>
          <li><Typography variant="body2">the property and client records</Typography></li>
          <li><Typography variant="body2">its ownership structure and every owner on it</Typography></li>
          <li><Typography variant="body2">every document uploaded against it</Typography></li>
          <li><Typography variant="body2">its notes, and any version signed off by compliance</Typography></li>
        </Box>
        <Typography variant="body2" color="text.secondary">
          This cannot be undone.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={mut.isPending}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => { setError(null); mut.mutate(); }}
          disabled={mut.isPending}
        >
          {mut.isPending ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
