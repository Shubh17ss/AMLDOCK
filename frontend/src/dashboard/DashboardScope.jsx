import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

// ── Dashboard scope ─────────────────────────────────────────────────────────
// A firm + branch selection shared across the whole app shell (sidebar selector,
// dashboard hub, CDD Register stats). `firm` / `branch` are `{ id, name } | null`;
// null means "all". Persisted per user in localStorage so it survives refresh.
// `initialized` guards one-time default seeding (from the signed-in user); a
// saved selection counts as initialized so seeding never overwrites it.

const DashboardScopeContext = createContext(null);

const keyFor = (user) => `amldock.dashScope.${user?.id ?? user?.email ?? 'anon'}`;

function readSaved(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw);
      return { firm: saved.firm ?? null, branch: saved.branch ?? null, initialized: true };
    }
  } catch { /* corrupt or unavailable storage — fall through to defaults */ }
  return { firm: null, branch: null, initialized: false };
}

export function DashboardScopeProvider({ children }) {
  const { user } = useAuth();
  const storageKey = keyFor(user);

  // Hydrate synchronously on mount (the shell only mounts once auth is resolved).
  const saved = useMemo(() => readSaved(storageKey), [storageKey]);
  const [firm, setFirm] = useState(saved.firm);
  const [branch, setBranch] = useState(saved.branch);
  const [initialized, setInitialized] = useState(saved.initialized);

  // Persist every settled selection (including "all" = nulls).
  useEffect(() => {
    if (!initialized) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ firm, branch })); } catch { /* ignore */ }
  }, [firm, branch, initialized, storageKey]);

  const value = useMemo(
    () => ({ firm, setFirm, branch, setBranch, initialized, setInitialized }),
    [firm, branch, initialized],
  );

  return <DashboardScopeContext.Provider value={value}>{children}</DashboardScopeContext.Provider>;
}

export function useDashboardScope() {
  const ctx = useContext(DashboardScopeContext);
  if (!ctx) throw new Error('useDashboardScope must be used within a DashboardScopeProvider');
  return ctx;
}

/** Keep only the deals matching the selected firm/branch (by name; null = all). */
export function scopeFilterDeals(deals, { firm, branch }) {
  return (deals ?? []).filter(
    (d) => (!firm || d.firmName === firm.name) && (!branch || d.branchName === branch.name),
  );
}

/** Hook form for dashboards: returns the deals narrowed to the active scope. */
export function useScopedDeals(deals) {
  const { firm, branch } = useDashboardScope();
  return useMemo(() => scopeFilterDeals(deals, { firm, branch }), [deals, firm, branch]);
}
