import { createContext, useContext, useEffect, useMemo } from 'react';

// ── Dashboard colour mode ────────────────────────────────────────────────────
// Owns the data-theme attribute that styles/theme-vars.css keys its palette off.
// Mounted ONLY inside AppShell: unmounting (navigating to the static site, signing
// out) removes the attribute, so landing/pricing/login are unaffected either way.
//
// The attribute lives on <html> rather than the shell's own DOM because MUI
// portals (dialogs, menus, pickers, toasts) mount under <body> and must inherit
// the same variables.
//
// ── Light only, for now ──────────────────────────────────────────────────────
// The sun/moon toggle has been taken out of the app bar. This provider stays, and
// stays pinned to light, for two reasons:
//
//   1. The choice used to persist in localStorage. Deleting this outright would
//      leave anyone who had switched to dark stuck there with no way back — the
//      attribute would simply never be written, and their last dark palette would
//      keep rendering. Writing 'light' on every mount clears that for good.
//   2. The dark palette in theme-vars.css is untouched, so bringing the toggle
//      back is restoring a component and a setState, not rebuilding a theme.

const STORAGE_KEY = 'amldock.colorMode';

const ColorModeContext = createContext(null);

export function ColorModeProvider({ children }) {
  const mode = 'light';

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    // Overwrites, rather than reads, a stored preference: see the note above.
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private mode etc. */ }
    return () => { delete document.documentElement.dataset.theme; };
  }, []);

  // `toggle` is kept as a no-op so a stray caller cannot crash the shell; there is
  // none today, and the button that used to call it is gone.
  const value = useMemo(() => ({ mode, toggle: () => {} }), []);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}

export function useColorMode() {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used within a ColorModeProvider');
  return ctx;
}
