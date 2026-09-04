import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { roleLabel } from '../auth/roles.js';
import { changePassword } from '../api/auth.js';
import { updateMyProfile } from '../api/users.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { ChangeEmailDialog } from '../features/profile/ChangeEmailDialog.jsx';
import { DealNotificationsCard } from '../features/notifications/DealNotificationsCard.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { tokens } from '../theme/theme.js';

export function ProfilePage() {
  const { user, adoptSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ kind: 'success', message: 'Password changed.' });
    } catch (err) {
      setFeedback({ kind: 'error', message: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader eyebrow={roleLabel(user?.role)} title="Profile" />
      <IdentityCard user={user} adoptSession={adoptSession} />

      <DealNotificationsCard />

      {user?.role === 'ROOT' ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Change password</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2} sx={{ maxWidth: 400 }}>
                <TextField label="Current password" type="password" value={currentPassword}
                           onChange={(e) => setCurrentPassword(e.target.value)} required />
                <TextField label="New password" type="password" value={newPassword}
                           onChange={(e) => setNewPassword(e.target.value)} required helperText="At least 8 characters" />
                {feedback && <Alert severity={feedback.kind}>{feedback.message}</Alert>}
                <Box>
                  <Button type="submit" variant="contained" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Update password'}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Sign-in</Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              Your account is passwordless — you sign in with your email and a one-time code.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

/**
 * Your name, your email, and what you are.
 *
 * <p>The two editable things are deliberately not edited the same way. A name is a label you
 * assert — nothing depends on it, so it saves on a button press. An email is the credential you
 * sign in with, so it goes through a dialog that proves the new address reaches you first.
 * Presenting them as one form with one Save would say the two changes are alike, and the second
 * would then appear to fail: it does not take effect when you press Save, and it should not.
 *
 * <p>Role and firm are shown but not editable by anyone here — those are decided for you, and by
 * someone else.
 */
function IdentityCard({ user, adoptSession }) {
  const { showToast } = useToast();
  const [name, setName] = useState(user?.fullName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);

  // Re-seed when the session changes underneath — after an email change the context is replaced,
  // and a stale field would sit there contradicting the card it is part of.
  useEffect(() => { setName(user?.fullName ?? ''); }, [user?.fullName]);

  const trimmed = name.trim();
  const dirty = trimmed !== (user?.fullName ?? '');

  const saveName = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    try {
      adoptSession(await updateMyProfile({ fullName: trimmed }));
      showToast({ severity: 'success', message: 'Name updated' });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Your details</Typography>
        <Divider sx={{ mb: 2 }} />

        <Box component="form" onSubmit={saveName}>
          <Stack spacing={2} sx={{ maxWidth: 460 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              inputProps={{ maxLength: 255 }}
            />

            {/* Read-only, with its own action beside it — the field is not the way this changes. */}
            <Box>
              <Typography variant="caption" sx={{ color: tokens.muted }}>Email</Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography>{user?.email}</Typography>
                <Button size="small" onClick={() => setEmailOpen(true)}>Change email</Button>
              </Stack>
              <Typography variant="caption" sx={{ color: tokens.muted }}>
                You sign in with this address, so changing it needs a code sent to the new one.
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mb: 0.5 }}>
                Role
              </Typography>
              <Chip size="small" label={roleLabel(user?.role)} />
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Box>
              <Button type="submit" variant="contained" disabled={saving || !dirty || !trimmed}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </CardContent>

      <ChangeEmailDialog
        open={emailOpen}
        currentEmail={user?.email}
        onClose={() => setEmailOpen(false)}
        onChanged={(me) => {
          adoptSession(me);
          setEmailOpen(false);
          showToast({ severity: 'success', message: `Signing in with ${me.email} from now on` });
        }}
      />
    </Card>
  );
}
