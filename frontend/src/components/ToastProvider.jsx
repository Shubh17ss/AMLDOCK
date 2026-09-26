import { createContext, useCallback, useContext } from 'react';
import { Box, Button, Typography, keyframes } from '@mui/material';
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
 * An optional `action: { label, onClick }` puts one button after the message — what an Undo needs,
 * and nothing more. Omitted, the toast is exactly what it always was.
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

/*
 * Enter and leave, as keyframes rather than as a CSS transition.
 *
 * This has to be an animation, and the reason is not stylistic. react-hot-toast creates every
 * toast with `visible: true` already set, so the element mounts at its final opacity — a
 * transition has no starting value to move from and the toast simply appears. (Leaving worked,
 * because `visible` flips to false on an element that is already on screen.) An animation runs
 * on mount, which is how the library's own ToastBar does it; `toast.custom` bypasses ToastBar,
 * so the animation has to be supplied here.
 *
 * A fade with a token of lift, not a slide: these appear over the top of the page the user is
 * reading, and something that travels draws the eye harder than something that resolves.
 */
const enter = keyframes`
  from { opacity: 0; transform: translateY(-10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const leave = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-6px) scale(0.98); }
`;

/** The same two, for anyone who has asked not to be moved. */
const enterPlain = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const leavePlain = keyframes`from { opacity: 1; } to { opacity: 0; }`;

/**
 * One toast.
 *
 * `t.visible` is react-hot-toast's own enter/leave flag, so the same element plays both
 * directions and is unmounted only once the leave has finished — the library waits 1s before
 * removing a dismissed toast, comfortably longer than the 200ms below.
 */
function ToastBody({ t, message, severity, action, onActionDone }) {
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
        // `forwards` so the leave holds at zero until react-hot-toast unmounts it; without it
        // the toast would snap back to full opacity for the last stretch of its life.
        animation: t.visible
          ? `${enter} 260ms cubic-bezier(0.22, 1, 0.36, 1) forwards`
          : `${leave} 200ms cubic-bezier(0.4, 0, 1, 1) forwards`,
        '@media (prefers-reduced-motion: reduce)': {
          animation: t.visible
            ? `${enterPlain} 200ms ease forwards`
            : `${leavePlain} 160ms ease forwards`,
        },
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
      {/* Dismissing on click is the point: an Undo that leaves its own toast on screen reads as
          though it did not take. */}
      {action && (
        <Button
          size="small"
          onClick={() => { action.onClick?.(); onActionDone?.(); }}
          sx={{
            ml: 'auto',
            flexShrink: 0,
            fontFamily: fonts.body,
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: tone.color,
            textTransform: 'none',
            px: 1,
            minWidth: 0,
            '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}

export function ToastProvider({ children }) {
  const showToast = useCallback(({ message, severity = 'info', autoHideMs = 5000, action }) => {
    toast.custom(
      (t) => (
        <ToastBody
          t={t}
          message={message}
          severity={severity}
          action={action}
          onActionDone={() => toast.dismiss(t.id)}
        />
      ),
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
