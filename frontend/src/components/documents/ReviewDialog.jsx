import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { setDocumentReviewDate, completeDocumentReview } from '../../api/documentReviews.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * Set the next review date for one compliance module, or mark the review complete (stamping
 * today). Both write to the firm/branch scope currently selected in the sidebar.
 *
 * Shared by every surface that exposes a review: the module cards on the dashboard and the
 * section landings, and the compliance-document register pages.
 *
 * @param moduleKey module id from moduleRegistry.jsx — the review key
 * @param title     human label for the module, used in the dialog copy
 * @param review    the current DocumentReviewDto for this module (or null)
 */
export function ReviewDialog({ open, onClose, moduleKey, title, review }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const [date, setDate] = useState('');

  // Seed the input from the current value each time the dialog opens.
  useEffect(() => {
    if (open) setDate(review?.nextReviewDate ?? '');
  }, [open, review]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['documentReviews'] });
    qc.invalidateQueries({ queryKey: ['complianceActivity'] });
  };

  const saveMut = useMutation({
    mutationFn: () => setDocumentReviewDate({
      moduleKey, nextReviewDate: date || null, firmId: firm?.id, branchId: branch?.id,
    }),
    onSuccess: () => {
      invalidate();
      showToast({ severity: 'success', message: date ? 'Review date saved' : 'Review date cleared' });
      onClose();
    },
    onError: (e) => showToast({ severity: 'error', message: e.response?.data?.message || 'Could not save. Try again.' }),
  });

  const completeMut = useMutation({
    mutationFn: () => completeDocumentReview({ moduleKey, firmId: firm?.id, branchId: branch?.id }),
    onSuccess: () => {
      invalidate();
      showToast({ severity: 'success', message: 'Marked review complete' });
    },
    onError: (e) => showToast({ severity: 'error', message: e.response?.data?.message || 'Could not complete. Try again.' }),
  });

  const busy = saveMut.isPending || completeMut.isPending;
  const lastReviewed = review?.lastCompletedAt;

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{title} review</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>
            Set when this module is next due for review. The status shows on its card.
          </Typography>
          <TextField
            label="Next review date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
            p: 1.5, borderRadius: '10px', backgroundColor: tokens.tileRaised, border: `1px solid ${tokens.hairline}`,
          }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: tokens.ink }}>
                Mark reviewed today
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: tokens.muted }}>
                {lastReviewed ? `Last reviewed ${dateFmt(lastReviewed)}` : 'Not yet reviewed'}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<CheckCircleRoundedIcon />}
              disabled={busy}
              onClick={() => completeMut.mutate()}
            >
              {completeMut.isPending ? 'Saving…' : 'Mark complete'}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" startIcon={<EventAvailableIcon />} disabled={busy}
                onClick={() => saveMut.mutate()}>
          {saveMut.isPending ? 'Saving…' : 'Save date'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
