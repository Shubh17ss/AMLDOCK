import { useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, IconButton, InputAdornment, Link,
  Stack, TextField, Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import logoSrc from '../../assets/logos/image.png';

const NEU_BASE   = '#E0E5EC';
const NEU_FG     = '#3D4852';
const NEU_MUTED  = '#6B7280';
const NEU_ACCENT = '#6C63FF';
const EXT        = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_SM     = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const EXT_H      = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)';

export function LoginPage() {
  const { user, login, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'authed' && user) {
    const from = location.state?.from?.pathname || '/app';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      showToast({ severity: 'success', message: 'Welcome back' });
      const from = location.state?.from?.pathname || '/app';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = (e) => {
    e.preventDefault();
    showToast({
      severity: 'info',
      message: 'Password recovery is coming soon — ask your administrator for a reset.',
    });
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: NEU_BASE,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        px: { xs: 3, sm: 5 }, py: 2.5,
      }}>
        <Brand />
      </Box>

      {/* Centered card */}
      <Box sx={{
        flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, py: { xs: 3, sm: 6 },
      }}>
        <Box sx={{
          width: '100%', maxWidth: 420,
          backgroundColor: NEU_BASE,
          borderRadius: 4,
          boxShadow: EXT,
          p: { xs: 4, sm: 5 },
        }}>
          {/* Card header */}
          <Stack spacing={0.5} sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{
              fontWeight: 800, color: NEU_FG,
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            }}>
              Sign in
            </Typography>
            <Typography variant="body2" sx={{ color: NEU_MUTED }}>
              Use your AMLDOCK email and password.
            </Typography>
          </Stack>

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                fullWidth
              />

              <Box>
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((v) => !v)}
                          onMouseDown={(e) => e.preventDefault()}
                          edge="end"
                          size="small"
                          sx={{ boxShadow: 'none', backgroundColor: 'transparent', '&:hover': { boxShadow: 'none' } }}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.75 }}>
                  <Link
                    href="#"
                    onClick={handleForgot}
                    underline="hover"
                    sx={{ fontSize: '0.8rem', color: NEU_ACCENT, fontWeight: 500 }}
                  >
                    Forgot password?
                  </Link>
                </Box>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting || !email || !password}
                sx={{ py: 1.5, mt: 1 }}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box sx={{ py: 3, textAlign: 'center', color: NEU_MUTED, fontSize: '0.78rem' }}>
        © {new Date().getFullYear()} AMLDOCK · Compliance, calmer
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
     <RouterLink to="/" className="flex items-center neu-focus rounded-2xl">
            <img src={logoSrc} alt="AMLDOCK" className="h-24 w-auto object-contain" />
          </RouterLink>

    </Box>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2L3 5.5V10C3 13.87 6.13 17.5 10 18.5C13.87 17.5 17 13.87 17 10V5.5L10 2Z"
        fill="rgba(108,99,255,0.15)" stroke="#6C63FF" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path
        d="M6.5 10L8.5 12L13.5 7.5"
        stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
