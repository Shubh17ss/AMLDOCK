import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Divider, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { roleLabel } from '../auth/roles.js';
import { changePassword } from '../api/auth.js';
import { PageHeader } from '../components/PageHeader.jsx';

export function ProfilePage() {
  const { user } = useAuth();
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
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography><strong>Name:</strong> {user?.fullName}</Typography>
            <Typography><strong>Email:</strong> {user?.email}</Typography>
            <Typography><strong>Role:</strong> {roleLabel(user?.role)}</Typography>
            {user?.realEstateFirmId && (
              <Typography><strong>Firm ID:</strong> {user.realEstateFirmId}</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

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
            <Typography variant="body2" color="text.secondary">
              Your account is passwordless — you sign in with your email and a one-time code.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
