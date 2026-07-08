import { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

const ToastContext = createContext(null);

/**
 * Tiny global toast/snackbar wrapper. Usage:
 *   const { showToast } = useToast();
 *   showToast({ message: 'Saved', severity: 'success' });
 * The provider keeps a small queue so back-to-back triggers don't drop messages.
 */
export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  const showToast = useCallback((toast) => {
    setQueue((q) => [...q, { id: Date.now() + Math.random(), severity: 'info', autoHideMs: 5000, ...toast }]);
  }, []);

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setCurrent(null);
  };
  const handleExited = () => {
    setCurrent(null);
  };

  // Drain queue → current
  if (!current && queue.length > 0) {
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        key={current?.id}
        open={Boolean(current)}
        autoHideDuration={current?.autoHideMs ?? 5000}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        anchorOrigin={current?.anchorOrigin ?? { vertical: 'bottom', horizontal: 'right' }}
      >
        {current ? (
          <Alert severity={current.severity} variant="filled" onClose={handleClose} sx={{ width: '100%' }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
