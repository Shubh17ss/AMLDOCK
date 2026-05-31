import { useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, IconButton, InputAdornment, Link,
  Stack, TextField, Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { palette } from '../theme/theme.js';

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
      bgcolor: palette.ink[50],
      // Subtle radial wash behind the card, biased toward the centre.
      backgroundImage: `radial-gradient(1200px 480px at 50% -10%, ${palette.trust[50]} 0%, transparent 60%)`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar with the AMLDOCK lockup on the right (placeholder for the logo) */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
        px: { xs: 3, sm: 5 }, py: 3,
      }}>
        <Brand />
      </Box>

      {/* Centered card */}
      <Box sx={{
        flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        px: 2, py: { xs: 3, sm: 6 },
      }}>
        <Card sx={{
          width: '100%', maxWidth: 440,
          borderRadius: 3,
          border: `1px solid ${palette.ink[200]}`,
          boxShadow: '0 24px 48px -16px rgba(15, 42, 79, 0.18), 0 8px 24px -8px rgba(15, 42, 79, 0.08)',
        }}>
          <CardContent sx={{ p: { xs: 4, sm: 5 } }}>
            <Stack spacing={0.5} sx={{ mb: 8 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: palette.ink[900] }}>
                Sign in
              </Typography>
              <Typography variant="body2" sx={{ color: palette.ink[500] }}>
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
                          >
                            {showPassword
                              ? <VisibilityOff fontSize="small" />
                              : <Visibility fontSize="small" />}
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
                      sx={{
                        fontSize: '0.8rem',
                        color: palette.trust[600],
                        fontWeight: 500,
                      }}
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
                  sx={{ py: 1.25, mt: 1.5 }}
                >
                  {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{
        py: 3, textAlign: 'center',
        color: palette.ink[500], fontSize: '0.78rem',
      }}>
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
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1.25,
        textDecoration: 'none', color: 'inherit',
      }}
    >
      <Box sx={{
        width: 30, height: 30, borderRadius: 1.25,
        background: `linear-gradient(135deg, ${palette.trust[500]} 0%, ${palette.trust[700]} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 10px rgba(15, 42, 79, 0.18)',
      }}>
        <Typography sx={{
          color: '#fff', fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.04em',
        }}>
          A
        </Typography>
      </Box>
      <Typography sx={{
        fontWeight: 700, color: palette.trust[800],
        letterSpacing: '0.14em', fontSize: '0.9rem',
      }}>
        AMLDOCK
      </Typography>
    </Box>
  );
}
