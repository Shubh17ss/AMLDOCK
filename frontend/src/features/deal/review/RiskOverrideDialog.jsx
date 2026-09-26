import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
  Typography,
} from '@mui/material';
import { tokens, fonts } from '../../../theme/theme.js';

/** The same three bands the header chip uses, so the two surfaces cannot drift apart. */
const RATING_STYLE = {
  LOW: { label: 'LOW', fg: tokens.approved },
  MEDIUM: { label: 'MEDIUM', fg: tokens.review },
  HIGH: { label: 'HIGH', fg: tokens.rejected },
};

/**
 * Setting the deal's risk band by hand.
 *
 * <p>Both ratings are on screen at once, which is the point of the dialog rather than a detail
 * of it: a reviewer pinning a band needs to see what they are overruling, and one lifting an
 * override needs to see whether the file has caught up with the decision. Choosing the
 * calculated band is how the override is released.
 *
 * <p>The comment is required, with the same three-character floor the server enforces. A rating
 * that disagrees with its own workings is defensible only if the record says why.
 */
export function RiskOverrideDialog({
  open, calculatedRating, currentRating, targetRating, onClose, onSubmit, submitting,
}) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setComment('');
      setError(null);
    }
  }, [open]);

  const releasing = targetRating === calculatedRating;

  const submit = async (e) => {
    e.preventDefault();
    if (comment.trim().length < 3) {
      setError('Say why in at least a few words — it goes on the audit trail.');
      return;
    }
    try {
      await onSubmit(targetRating, comment.trim());
    } catch (err) {
      setError(err.response?.data?.message || 'Could not set the risk level.');
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Client risk override</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <Stack spacing={1.25}>
              <RatingRow label="Calculated client risk" rating={calculatedRating} />
              <RatingRow label="Current client risk" rating={currentRating} />
              <RatingRow label="New client risk" rating={targetRating} />
            </Stack>

            {releasing ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                This matches the calculated risk, so it releases the override and hands the
                rating back to the deal&apos;s own answers.
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                The rating will stop following the deal&apos;s answers until the override is
                lifted. The score underneath keeps moving, and is shown on this tab.
              </Alert>
            )}

            <TextField
              label="Comment"
              required
              multiline
              minRows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why this rating rather than the calculated one"
              helperText="Recorded against the deal in the audit log."
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Close</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || comment.trim().length < 3}
          >
            {submitting ? 'Applying…' : releasing ? 'Release override' : 'Apply'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function RatingRow({ label, rating }) {
  const style = RATING_STYLE[rating];
  return (
    <Stack direction="row" spacing={1.5} alignItems="baseline">
      <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, minWidth: 180 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontFamily: fonts.mono, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em',
          color: style?.fg ?? tokens.muted,
        }}
      >
        {style?.label ?? 'NOT ASSESSED'}
      </Typography>
    </Stack>
  );
}
