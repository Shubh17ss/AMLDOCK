import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { readSavedScope, writeSavedScope } from './scopeStorage.js';

// ── Dashboard scope ─────────────────────────────────────────────────────────
// A firm + branch selection shared across the whole app shell (sidebar selector,
// dashboard hub, CDD Register stats). `branch` is `{ id, name } | null` and `firm` is
// `{ id, name, country } | null`; null means "all". The firm's country is carried because it
// decides the currency amounts are shown in — see useCurrency.
// Persisted per user in localStorage (see scopeStorage.js) so it survives refresh; a selection
// saved before country existed simply has none, and falls back to NZD until the selector is
// touched. ScopeSelector discards a saved selection whose firm or branch no longer exists.
// `initialized` guards one-time default seeding (from the signed-in user); a
// saved selection counts as initialized so seeding never overwrites it.

const DashboardScopeContext = createContext(null);

export function DashboardScopeProvider({ children }) {
  const { user } = useAuth();

  // Hydrate synchronously on mount (the shell only mounts once auth is resolved).
  const saved = useMemo(() => readSavedScope(user), [user]);
  const [firm, setFirm] = useState(saved.firm);
  const [branch, setBranch] = useState(saved.branch);
  const [initialized, setInitialized] = useState(saved.initialized);

  // Persist every settled selection (including "all" = nulls).
  useEffect(() => {
    if (!initialized) return;
    writeSavedScope(user, { firm, branch });
  }, [firm, branch, initialized, user]);

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
