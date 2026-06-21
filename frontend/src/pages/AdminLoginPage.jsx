import { useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Link, Stack, TextField, Typography,
} from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import logoSrc from '../../assets/logos/image.png';

import { tokens, shadows } from '../theme/theme.js';

const NEU_BASE   = tokens.canvas;
const NEU_FG     = tokens.ink;
const NEU_MUTED  = tokens.muted;
const NEU_ACCENT = tokens.blue;
const EXT        = shadows.md;

/**
 * Hardened sign-in for the platform administrator (ROOT): password first, then an
 * email one-time code as a second factor. All other roles use the email + OTP route at /login.
 */
export function AdminLoginPage() {
  const { user, status, adminLogin, adminVerify } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'code'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'authed' && user) {
    const from = location.state?.from?.pathname || '/app';
    return <Navigate to={from} replace />;
  }

  const handleCredentials = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminLogin(email, password);
      setStep('code');
      showToast({ severity: 'info', message: 'Password accepted — check your email for a code.' });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await adminVerify(email, code);
      showToast({ severity: 'success', message: 'Welcome back' });
      const from = location.state?.from?.pathname || '/app';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: NEU_BASE, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 3, sm: 5 }, py: 2.5 }}>
        <Box component={RouterLink} to="/" sx={{ display: 'inline-flex', textDecoration: 'none' }}>
          <img src={logoSrc} alt="AMLDOCK" className="h-24 w-auto object-contain" />
        </Box>
      </Box>

      <Box sx={{
        flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, py: { xs: 3, sm: 6 },
      }}>
        <Box sx={{
          width: '100%', maxWidth: 480,
          backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`, borderRadius: 4, boxShadow: EXT,
          p: { xs: 4, sm: 5 },
        }}>
          <Stack spacing={0.5} sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{
              fontWeight: 800, color: NEU_FG,
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            }}>
              Administrator sign-in
            </Typography>
            <Typography variant="body2" sx={{ color: NEU_MUTED }}>
              {step === 'credentials'
                ? 'Password, then a one-time code sent to your email.'
                : `Enter the 6-digit code we sent to ${email}.`}
            </Typography>
          </Stack>

          {step === 'credentials' ? (
            <Box component="form" onSubmit={handleCredentials}>
              <Stack spacing={2.5}>
                <TextField
                  label="Email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required autoFocus autoComplete="email" fullWidth
                />
                <TextField
                  label="Password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="current-password" fullWidth
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button
                  type="submit" variant="contained" size="large"
                  disabled={submitting || !email || !password}
                  sx={{ py: 1.5, mt: 1 }}
                >
                  {submitting ? 'Checking…' : 'Continue'}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleVerify}>
              <Stack spacing={2.5}>
                <TextField
                  label="One-time code" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required autoFocus fullWidth
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'one-time-code' }}
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button
                  type="submit" variant="contained" size="large"
                  disabled={submitting || code.length < 6}
                  sx={{ py: 1.5, mt: 1 }}
                >
                  {submitting ? 'Verifying…' : 'Verify & sign in'}
                </Button>
              </Stack>
            </Box>
          )}

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link component={RouterLink} to="/login" underline="hover"
                  sx={{ fontSize: '0.8rem', color: NEU_ACCENT, fontWeight: 500 }}>
              Not an administrator? Sign in here
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
