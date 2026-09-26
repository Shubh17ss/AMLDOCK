import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
  Typography,
} from '@mui/material';
import { tokens, fonts } from '../../../theme/theme.js';
import { bandOf } from './riskBands.js';

/**
 * Setting the deal's risk band by hand.
 *
 * <p>All three ratings are on screen at once, which is the point of the dialog rather than a
 * detail of it: a reviewer needs to see what they are overruling and what the file says on its
 * own before committing to a band.
 *
 * <p>Choosing the calculated band is an override like any other, not a withdrawal of one. It
 * records that a reviewer agreed with the engine deliberately, which is a different fact from
 * nobody having looked — and the comment and byline are how that difference is kept.
 *
 * <p>The comment is required, with the same three-character floor the server enforces. A rating
 * set by hand is defensible only if the record says why, and that holds whether it disagrees
 * with the workings or matches them.
 */
export function RiskOverrideDialog({
  open, calculatedRating, currentRating, targetRating, onClose, onSubmit, submitting,
}) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);

  /*
   * The band being set, remembered across the close.
   *
   * RiskPanel closes this dialog with setOverride(null), which drops `open` to false and
   * `targetRating` to null in the same commit — but MUI keeps the dialog mounted for its close
   * transition, so the "New client risk" row would spend those frames rendering its
   * not-assessed fallback. A dialog on its way out should keep saying what it said.
   *
   * Adjusting state during render is React's documented way to derive from a prop with memory:
   * it re-renders before committing, so no stale frame is ever painted. Guarded on both null
   * and inequality, so it cannot loop.
   */
  const [shownTarget, setShownTarget] = useState(targetRating);
  if (targetRating != null && targetRating !== shownTarget) setShownTarget(targetRating);

  useEffect(() => {
    if (open) {
      setComment('');
      setError(null);
    }
  }, [open]);

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
        <DialogTitle>Deal risk override</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            <Stack spacing={1.25}>
              <RatingRow label="Calculated client risk" rating={calculatedRating} />
              <RatingRow label="Current client risk" rating={currentRating} />
              {/* The latched value, not the prop — see shownTarget above. The other two come
                  off the loaded assessment and do not go null on close. */}
              <RatingRow label="New client risk" rating={shownTarget} />
            </Stack>

            <TextField
              label="Comment"
              required
              multiline
              minRows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why this rating rather than the calculated one"
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
            {submitting ? 'Applying…' : 'Apply'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/**
 * One rating, drawn the way every other surface draws a band: a wash, a border, and the band's
 * own readable text colour.
 *
 * <p>`bandOf` always answers with a colour, so an unrated deal is tested for here rather than
 * leaning on it — "not assessed" is a real state on a deal nobody has rated yet, and it should
 * read as absent rather than as a band.
 */
function RatingRow({ label, rating }) {
  const band = rating ? bandOf(rating) : null;

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, minWidth: 180 }}>
        {label}
      </Typography>
      <Box
        sx={{
          display: 'inline-flex',
          px: 1,
          py: 0.25,
          // Square-ish rather than a pill: a band is a value, and the small radius keeps it in
          // the same family as the cards and buttons without imitating either.
          borderRadius: '6px',
          backgroundColor: band ? band.bg : tokens.hover,
          border: `1px solid ${band ? band.border : tokens.hairline}`,
          // `text`, not `fg`: this sits on its own wash, which is what that variable is for.
          color: band ? band.text : tokens.muted,
          fontFamily: fonts.mono,
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        {rating ?? 'NOT ASSESSED'}
      </Box>
    </Stack>
  );
}
