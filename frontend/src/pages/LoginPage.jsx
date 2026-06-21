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

export function LoginPage() {
  const { user, status, requestOtp, verifyOtp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'authed' && user) {
    const from = location.state?.from?.pathname || '/app';
    return <Navigate to={from} replace />;
  }

  const handleRequest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(email);
      setStep('code');
      showToast({ severity: 'success', message: 'A one-time code is on its way.' });
    } catch (err) {
      setError(err.response?.data?.message || 'No user is attached to this email');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await verifyOtp(email, code);
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
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: NEU_BASE,
      display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 3, sm: 5 }, py: 2.5 }}>
        <Brand />
      </Box>

      <Box sx={{
        flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, py: { xs: 3, sm: 6 },
      }}>
        <Box sx={{
          width: '100%', maxWidth: 420,
          backgroundColor: tokens.tile, border: `1px solid ${tokens.hairline}`, borderRadius: 4, boxShadow: EXT,
          p: { xs: 4, sm: 5 },
        }}>
          <Stack spacing={0.5} sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{
              fontWeight: 800, color: NEU_FG,
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            }}>
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ color: NEU_MUTED }}>
              {step === 'email'
                ? "Enter your email — we'll send you a one-time code."
                : `We sent a 6-digit code to ${email}.`}
            </Typography>
          </Stack>

          {step === 'email' ? (
            <Box component="form" onSubmit={handleRequest}>
              <Stack spacing={2.5}>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required autoFocus autoComplete="email" fullWidth
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button
                  type="submit" variant="contained" size="large"
                  disabled={submitting || !email}
                  sx={{ py: 1.5, mt: 1 }}
                >
                  {submitting ? 'Sending code…' : 'Send code'}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleVerify}>
              <Stack spacing={2.5}>
                <TextField
                  label="One-time code"
                  value={code}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Link
                    href="#"
                    onClick={(e) => { e.preventDefault(); setStep('email'); setCode(''); setError(null); }}
                    underline="hover"
                    sx={{ fontSize: '0.8rem', color: NEU_MUTED, fontWeight: 500 }}
                  >
                    Use a different email
                  </Link>
                  <Link
                    href="#"
                    onClick={handleRequest}
                    underline="hover"
                    sx={{ fontSize: '0.8rem', color: NEU_ACCENT, fontWeight: 500 }}
                  >
                    Resend code
                  </Link>
                </Box>
              </Stack>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ py: 3, textAlign: 'center', color: NEU_MUTED, fontSize: '0.78rem' }}>
        © {new Date().getFullYear()} AMLDOCK · Compliance, calmer
        {' · '}
        <Link component={RouterLink} to="/admin-login" underline="hover" sx={{ color: NEU_MUTED }}>
          Administrator sign-in
        </Link>
      </Box>
    </Box>
  );
}

function Brand() {
  return (
    <Box
      component={RouterLink}
      to="/"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, textDecoration: 'none' }}
    >
      <img src={logoSrc} alt="AMLDOCK" className="h-24 w-auto object-contain" />
    </Box>
  );
}
