import { createContext, useCallback, useContext } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import toast, { Toaster } from 'react-hot-toast';
import { tokens, fonts, shadows } from '../theme/theme.js';

const ToastContext = createContext(null);

/**
 * Global toasts, on react-hot-toast. Usage is unchanged from the MUI Snackbar this replaces:
 *
 *   const { showToast } = useToast();
 *   showToast({ message: 'Saved', severity: 'success' });
 *
 * The `useToast()` façade is kept deliberately — there are 40-odd call sites, and none of them
 * should have to know which library is underneath. `anchorOrigin` is accepted and ignored:
 * position is a property of the app now, not of each individual message.
 *
 * Two things the queue-based Snackbar could not do, and this does: stacked toasts (it showed one
 * at a time and made the rest wait), and state updates that happen in an effect rather than
 * during render.
 */

/** Severity → the colour it carries and the glyph that leads it. */
const TONE = {
  success: { color: 'var(--cl-ok-text)',   wash: 'var(--cl-ok-wash)',   border: 'var(--cl-ok-border)',   Icon: CheckCircleRoundedIcon },
  error:   { color: 'var(--cl-err-text)',  wash: 'var(--cl-err-wash)',  border: 'var(--cl-err-border)',  Icon: ErrorRoundedIcon },
  warning: { color: 'var(--cl-warn-text)', wash: 'var(--cl-warn-wash)', border: 'var(--cl-warn-border)', Icon: WarningRoundedIcon },
  info:    { color: tokens.blue,           wash: tokens.blueWash,       border: tokens.blue,             Icon: InfoRoundedIcon },
};

/**
 * One toast.
 *
 * A fade, not a slide: these appear over the top of the page the user is reading, and something
 * that travels draws the eye harder than something that simply resolves. `t.visible` is
 * react-hot-toast's own enter/leave flag, so the same transition runs in both directions and the
 * element is only unmounted once it has finished.
 */
function ToastBody({ t, message, severity }) {
  const tone = TONE[severity] ?? TONE.info;
  const { Icon } = tone;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        maxWidth: 'min(92vw, 460px)',
        px: 2,
        py: 1.25,
        borderRadius: '14px',
        backgroundColor: tone.wash,
        border: `1px solid ${tone.border}`,
        boxShadow: shadows.md,
        // The whole animation, in one property. `transform` carries a token of lift so the fade
        // has somewhere to come from without reading as motion.
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.98)',
        transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.22,1,0.36,1)',
        '@media (prefers-reduced-motion: reduce)': { transition: 'opacity 0.28s ease' },
      }}
    >
      <Icon sx={{ fontSize: 20, color: tone.color, flexShrink: 0 }} />
      <Typography sx={{
        fontFamily: fonts.body,
        fontSize: '0.875rem',
        fontWeight: 600,
        lineHeight: 1.35,
        color: tone.color,
      }}>
        {message}
      </Typography>
    </Box>
  );
}

export function ToastProvider({ children }) {
  const showToast = useCallback(({ message, severity = 'info', autoHideMs = 5000 }) => {
    toast.custom(
      (t) => <ToastBody t={t} message={message} severity={severity} />,
      { duration: autoHideMs },
    );
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Top centre: a status change belongs where the eye already is, not in a corner it has
          to find. `gutter` keeps stacked toasts from reading as one block. */}
      <Toaster
        position="top-center"
        gutter={10}
        containerStyle={{ top: 24 }}
        toastOptions={{ duration: 5000 }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
