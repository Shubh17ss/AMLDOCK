import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, Divider, Stack, TextField, Typography,
} from '@mui/material';
import { DealStatusChip } from '../../components/DealStatusChip.jsx';
import { OptionPill } from '../../components/OptionPill.jsx';
import {
  DEAL_STATUSES, dealStatusDot, dealStatusLabel, transitionsFrom,
} from '../../data/dealStatus.js';
import { tokens, fonts, motion } from '../../theme/theme.js';

/**
 * Changes a deal's status: pick where it goes, say why, confirm.
 *
 * <p>This replaces six differently-coloured verbs in the review screen's header. "Verify" was the
 * one that gave it away — beside an ownership structure it read as an action on the structure,
 * not as the thing that signs the deal off and ends compliance's involvement. A list of statuses
 * says what is actually happening: the deal is here, and it can go there.
 *
 * <p>The reason field follows the server. Hold, verify and send-back write a note
 * (`DealLifecycleService.RULES.noteRequired`); start review and close take no body at all, so
 * asking for a reason there would collect something with nowhere to go.
 *
 * Props:
 *   open, onClose
 *   deal: the deal, for its current status
 *   canOverride: boolean — senior managers may force any status
 *   submitting: boolean
 *   onSubmit: (transition, reason) => Promise — `transition` is a row of STATUS_TRANSITIONS, or
 *             an override row carrying `action: 'override'`
 */
export function DealStatusDialog({ open, deal, canOverride, onClose, onSubmit, submitting }) {
  const [choice, setChoice] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setChoice(null); setReason(''); setError(null); }
  }, [open]);

  const normal = useMemo(() => transitionsFrom(deal?.status), [deal?.status]);

  // Everything the table cannot reach from here. Senior managers only, and always with a reason:
  // a forced status with no explanation is the one thing an audit log cannot reconstruct.
  const forced = useMemo(() => {
    if (!canOverride) return [];
    const reachable = new Set(normal.map((t) => t.to));
    return DEAL_STATUSES
      .filter((s) => s !== deal?.status && !reachable.has(s))
      .map((s) => ({ to: s, action: 'override', noteRequired: true }));
  }, [canOverride, normal, deal?.status]);

  const needsReason = choice?.noteRequired ?? false;
  const reasonReady = !needsReason || reason.trim().length >= 3;

  const submit = async (e) => {
    e.preventDefault();
    if (!choice || !reasonReady) return;
    setError(null);
    try {
      await onSubmit(choice, needsReason ? reason.trim() : null);
    } catch (err) {
      setError(err.response?.data?.message || 'That didn’t go through. Try again.');
    }
  };

  const nothingToDo = normal.length === 0 && forced.length === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogContent sx={{ pt: 4, pb: 2 }}>
          <Stack spacing={1.25} sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ fontFamily: fonts.display, fontSize: '1.3rem', color: tokens.ink }}>
              Update status
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <Typography variant="body2" sx={{ color: tokens.muted }}>Currently</Typography>
              <DealStatusChip status={deal?.status} />
            </Stack>
          </Stack>

          {nothingToDo ? (
            <Alert severity="info">
              A {dealStatusLabel(deal?.status).toLowerCase()} deal has nowhere further to go.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {normal.length > 0 && (
                <PillRow>
                  {normal.map((t) => (
                    <StatusPill
                      key={`${t.action}-${t.to}`}
                      transition={t}
                      selected={choice?.to === t.to && choice?.action === t.action}
                      onSelect={() => { setChoice(t); setError(null); }}
                    />
                  ))}
                </PillRow>
              )}

              {forced.length > 0 && (
                <>
                  <Divider sx={{ pt: 1 }}>
                    <Typography
                      sx={{
                        fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: tokens.muted,
                      }}
                    >
                      Outside the normal order
                    </Typography>
                  </Divider>
                  <PillRow>
                    {forced.map((t) => (
                      <StatusPill
                        key={`override-${t.to}`}
                        transition={t}
                        isOverride
                        selected={choice?.to === t.to && choice?.action === 'override'}
                        onSelect={() => { setChoice(t); setError(null); }}
                      />
                    ))}
                  </PillRow>
                </>
              )}
            </Stack>
          )}

          {choice && (
            <Box sx={motion.respectful({
              mt: 3,
              animation: `reasonIn ${motion.swift} ${motion.ease} both`,
              '@keyframes reasonIn': {
                from: { opacity: 0, transform: 'translateY(-4px)' },
                to: { opacity: 1, transform: 'none' },
              },
            })}>
              {needsReason ? (
                <TextField
                  autoFocus
                  fullWidth
                  label="Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  multiline
                  minRows={4}
                  required
                  helperText={`${reason.length} characters`}
                />
              ) : (
                // No field, because the endpoint behind this move takes no body. Saying so beats
                // a box whose contents would be dropped on the way out.
                <Typography variant="body2" sx={{ color: tokens.muted }}>
                  This move is recorded on the deal's timeline without a note.
                </Typography>
              )}
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            color={choice?.action === 'override' ? 'warning' : 'primary'}
            disabled={submitting || !choice || !reasonReady}
          >
            {submitting ? 'Working…' : 'Update status'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/**
 * The pills side by side on anything wider than a phone, stacked full-width below that so each
 * label stays a comfortable tap target.
 */
function PillRow({ children }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      justifyContent="center"
    >
      {children}
    </Stack>
  );
}

/**
 * One status the deal could move to, drawn like the risk panel's bands: the status's own colour
 * on a wash of itself, so the choice reads the same way across the two decisions a reviewer makes.
 */
function StatusPill({ transition, selected, isOverride = false, onSelect }) {
  const fg = dealStatusDot(transition.to);
  return (
    <OptionPill
      label={dealStatusLabel(transition.to)}
      fg={fg}
      bg={`color-mix(in srgb, ${fg} 14%, transparent)`}
      selected={selected}
      onSelect={onSelect}
      tag={isOverride ? 'OVERRIDE' : null}
      tagColor="warning.main"
      sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'center' }}
    />
  );
}
