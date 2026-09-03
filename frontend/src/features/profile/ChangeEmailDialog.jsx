import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from '@mui/material';
import { requestEmailChange, verifyEmailChange } from '../../api/users.js';
import { OtpCodeField, isCompleteOtp } from '../../components/OtpCodeField.jsx';
import { tokens } from '../../theme/theme.js';

/**
 * Moving your sign-in address, in two steps.
 *
 * <p>The second step is the whole point. Sign-in here is an address plus a one-time code and
 * nothing else, so the address <em>is</em> the credential — and an address nobody has proved they
 * can read is an unverified one. Worse, a typo is unrecoverable by the person who made it: the code
 * that would fix it goes to the mailbox they cannot open. So the code goes to the new address
 * first, and the account only moves once it comes back.
 *
 * <p>Nothing changes between the steps. Closing here after sending a code leaves the account
 * exactly as it was, which is what lets the email say "ignore this and nothing happens".
 */
export function ChangeEmailDialog({ open, currentEmail, onClose, onChanged }) {
  const [step, setStep] = useState('address');   // 'address' | 'code'
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Reset on open, not on close: wiping while the dialog is still fading out shows the form
  // emptying itself on the way past.
  useEffect(() => {
    if (!open) return;
    setStep('address');
    setNewEmail('');
    setCode('');
    setError(null);
    setBusy(false);
  }, [open]);

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestEmailChange(newEmail.trim());
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send a code to that address');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await verifyEmailChange(code);
      onChanged(me);
    } catch (err) {
      setError(err.response?.data?.message || 'That code was not accepted');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{step === 'address' ? 'Change your email' : 'Confirm your new address'}</DialogTitle>

      <DialogContent>
        {step === 'address' ? (
          <Box component="form" onSubmit={send}>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                You sign in with this address, so we’ll send a code to the new one to confirm it
                reaches you. Nothing changes until you enter that code — <strong>{currentEmail}</strong>{' '}
                keeps working until then.
              </Typography>
              <TextField
                label="New email address"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoFocus
                fullWidth
                autoComplete="email"
              />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
        ) : (
          <Box component="form" onSubmit={confirm}>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                We sent a code to <strong>{newEmail}</strong>. Enter it to finish moving your
                account. If it doesn’t arrive, check that the address is right.
              </Typography>
              <OtpCodeField value={code} onChange={setCode} autoFocus />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {/* Going back re-sends rather than reusing the old code, which is correct: the code is
            bound to the address it was issued for, so a different address needs a different one. */}
        {step === 'code' && (
          <Button onClick={() => { setStep('address'); setCode(''); setError(null); }} disabled={busy}>
            Use a different address
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        {step === 'address' ? (
          <Button variant="contained" onClick={send} disabled={busy || !newEmail.trim()}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        ) : (
          <Button variant="contained" onClick={confirm} disabled={busy || !isCompleteOtp(code)}>
            {busy ? 'Confirming…' : 'Confirm'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
