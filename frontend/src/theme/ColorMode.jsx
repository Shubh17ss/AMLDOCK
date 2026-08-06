import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// ── Dashboard colour mode ────────────────────────────────────────────────────
// Owns the data-theme attribute that styles/theme-vars.css keys its dark palette
// off. Mounted ONLY inside AppShell: while a dashboard route is on screen the
// attribute reflects the persisted choice; unmounting (navigating to the static
// site, signing out) removes it, so landing/pricing/login can never render dark.
//
// The attribute lives on <html> rather than the shell's own DOM because MUI
// portals (dialogs, menus, pickers, toasts) mount under <body> and must inherit
// the same variables.

const STORAGE_KEY = 'amldock.colorMode';

const ColorModeContext = createContext(null);

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(readSaved);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private mode etc. */ }
    // Removing the attribute on unmount is what scopes dark mode to the shell.
    return () => { delete document.documentElement.dataset.theme; };
  }, [mode]);

  const value = useMemo(() => ({
    mode,
    toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
  }), [mode]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within a ColorModeProvider');
  return ctx;
}
