import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { isBranchLevel, requiresFirm, seesAllFirms } from '../auth/roles.js';
import { getFirm, listFirms, listBranches } from '../api/firms.js';
import { readSavedScope, writeSavedScope } from './scopeStorage.js';

// ── Dashboard scope ─────────────────────────────────────────────────────────
// A firm + branch selection shared across the whole app shell (sidebar selector,
// dashboard hub, CDD Register stats). `branch` is `{ id, name } | null` and `firm` is
// `{ id, name, country } | null`. The firm's country is carried because it decides the currency
// amounts are shown in — see useCurrency.
//
// Null no longer means "all". A single firm AND a single branch are now a precondition for using
// the app at all: anything wider is ambiguous, because you cannot say which register you are
// writing into. Null means "not chosen yet", and ScopeRequiredDialog blocks the shell until it
// isn't. `scopeComplete` is that question.
//
// Persisted per user in localStorage (see scopeStorage.js) so it survives refresh; a selection
// saved before country existed simply has none, and falls back to NZD until the selector is
// touched. A saved selection whose firm or branch no longer exists is discarded below.
//
// There is no "seeded once" flag any more. What the account decides — a firm-level user's entity,
// a branch-level user's both — is converged on every render, so a partial or stale saved scope
// cannot leave someone facing a chooser it can't fill in for them.

// ── Scope-exempt routes ─────────────────────────────────────────────────────
// The one hole in "no page renders without a scope", and it exists because the rule can otherwise
// trap the very person meant to satisfy it. A ROOT account on a fresh platform has no reporting
// entity to choose; an entity whose branches are all inactive offers no branch. Neither dead end is
// resolvable from a modal that only offers dropdowns, and both are repaired on exactly these
// screens — which read no scope of their own (FirmAdminDetailPage takes its firm id from the URL,
// FirmsAdminPage lists whatever the API returns).
//
// Path-based rather than a dismiss button on the dialog: it survives a refresh, it is declarative,
// and it cannot be arrived at by accident. Authorisation is not this list's job — both routes sit
// behind `ProtectedRoute roles={SETTINGS_ROLES}` in AppRoutes, so anyone else who types the URL is
// redirected to /app and simply meets the dialog again.
//
// A pure function of the pathname rather than a member of the context value: putting it in the
// value would force this provider to call useLocation(), re-creating the value memo on every
// navigation and re-rendering every scope consumer in the app for a fact only two of them need.
const SCOPE_EXEMPT_PREFIXES = ['/settings/reporting-entities'];

/** Whether `pathname` is a route allowed to render with an incomplete scope. */
export function isScopeExemptPath(pathname) {
  return SCOPE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const DashboardScopeContext = createContext(null);

export function DashboardScopeProvider({ children }) {
  const { user } = useAuth();

  // Hydrate synchronously on mount (the shell only mounts once auth is resolved).
  const saved = useMemo(() => readSavedScope(user), [user]);
  const [firm, setFirm] = useState(saved.firm);
  const [branch, setBranch] = useState(saved.branch);

  // Role buckets. AUDIT reads every entity, so it gets ROOT's entity switcher — the read-only
  // guarantee is enforced server-side by AuditReadOnlyFilter, not by pinning the scope.
  const role = user?.role;
  const isRoot = seesAllFirms(role);
  const branchLevel = isBranchLevel(role);
  const firmLevel = !isRoot && !branchLevel && requiresFirm(role);
  // Derived from state, not from role alone. A branch-level user whose record names no branch has
  // nothing to pin, and the server already supports them: DealService.create's firm-level arm lets
  // a branch-less actor use any active branch of their own firm, which is the only reason the deal
  // form's old branch picker worked for them. Gating on role would hand that working user a
  // permanently empty dropdown and lock them out of an app they can otherwise use.
  const branchSelectable = isRoot || firmLevel || !user?.firmBranchId;

  const currentFirmId = isRoot ? (firm?.id ?? null) : user?.realEstateFirmId;

  // These three live here rather than in ScopeSelector because the selector is a presentational
  // sidebar component, and the dialog that blocks the shell must not depend on it having mounted:
  // seeding would never run and a firm-level user would face a chooser with nothing pre-filled.
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms, enabled: isRoot });
  const firmQ = useQuery({
    queryKey: ['firm', user?.realEstateFirmId],
    queryFn: () => getFirm(user.realEstateFirmId),
    enabled: !isRoot && Boolean(user?.realEstateFirmId),
  });
  const branchesQ = useQuery({
    queryKey: ['firms', currentFirmId, 'branches'],
    queryFn: () => listBranches(currentFirmId),
    enabled: Boolean(currentFirmId),
  });

  // Memoised because the reconciliation effect below depends on them; a fresh array each render
  // would re-run it on every render.
  const activeFirms = useMemo(() => (firmsQ.data ?? []).filter((f) => f.active), [firmsQ.data]);
  const activeBranches = useMemo(() => (branchesQ.data ?? []).filter((b) => b.active), [branchesQ.data]);

  // Converge on what the user's account already decides — every render, not once.
  //
  // This used to be one-time seeding guarded by an `initialized` flag that a restored localStorage
  // scope also set. That guard could starve the very dialog it now feeds: a firm-level user holding
  // a saved `{firm: null, branch: null}` counted as initialised, skipped seeding, and would face a
  // blocking chooser with their entity permanently blank and no way to fill it. Converging is
  // idempotent, so there is nothing to guard — and it survives StrictMode's double-invoke.
  useEffect(() => {
    if (!user || !firmQ.data) return;
    const firmObj = { id: firmQ.data.id, name: firmQ.data.name, country: firmQ.data.country };

    if (branchLevel) {
      // Their firm and branch are facts about their account, not preferences — so pin both rather
      // than fill blanks. A branch-level user reassigned to another branch otherwise keeps the old
      // one in localStorage forever: reconciliation below only drops branches that were
      // deactivated or deleted, never ones that simply aren't theirs any more. That stale branch
      // becomes a 403 the moment we start sending it on deal creation.
      const b = (branchesQ.data ?? []).find((x) => x.id === user.firmBranchId);
      if (user.firmBranchId && !b) return;                      // wait for the branch name
      if (firm?.id !== firmObj.id) setFirm(firmObj);
      const want = b ? { id: b.id, name: b.name } : null;
      if ((branch?.id ?? null) !== (want?.id ?? null)) setBranch(want);
      return;
    }

    // Firm-level: the entity is theirs and never a choice, so fill it whenever it is missing. The
    // branch is the one thing they are asked for. ROOT and AUDIT belong to no firm and are asked
    // for both, so `firmQ` never runs for them and this effect is a no-op.
    if (!isRoot && !firm) setFirm(firmObj);
  }, [user, isRoot, branchLevel, firm, branch, firmQ.data, branchesQ.data]);

  // A saved scope can outlive what it points at — an entity deactivated, a branch removed, or a
  // dev database reset. Nothing else catches this: the selects display the firm and branch *names*
  // held in the saved scope, while their options come from the API, so the sidebar goes on naming
  // an entity that is gone while the dropdown beside it is empty. Convergence above cannot catch it
  // either: it fills what is missing and pins what is fixed, but a firm-level user's stale branch
  // is neither.
  //
  // Clearing to null now re-opens the blocking dialog, which is the honest answer for a scope that
  // no longer resolves.
  useEffect(() => {
    if (firm) {
      // A missing firm 404s, so an error is an answer here, not just a pending state.
      const firmSettled = isRoot ? firmsQ.isSuccess : (firmQ.isSuccess || firmQ.isError);
      if (!firmSettled) return;

      const stillExists = isRoot
        ? activeFirms.some((f) => f.id === firm.id)
        : firmQ.data?.id === firm.id;
      if (!stillExists) {
        setFirm(null);
        setBranch(null);   // a branch cannot outlive the firm it belonged to
        return;
      }
    }

    if (branch && branchesQ.isSuccess && !activeBranches.some((b) => b.id === branch.id)) {
      setBranch(null);
    }

    // A scope saved before `country` was carried has `{id, name}` only, which would price an
    // Australian entity in NZD via useCurrency's fallback. Repair it from the fresh DTO.
    if (firm && firm.country == null) {
      const fresh = isRoot ? activeFirms.find((f) => f.id === firm.id) : firmQ.data;
      if (fresh?.country) setFirm({ id: fresh.id, name: fresh.name, country: fresh.country });
    }
  }, [isRoot, firm, branch, activeFirms, activeBranches,
      firmsQ.isSuccess, firmQ.isSuccess, firmQ.isError, firmQ.data, branchesQ.isSuccess]);

  // Persist any non-empty selection. This used to be gated on `initialized`, which is gone; an
  // empty scope is worth nothing to restore, and a partial one (ROOT who picked an entity then
  // closed the tab) should survive so the dialog reopens on just the missing half.
  useEffect(() => {
    if (!firm && !branch) return;
    writeSavedScope(user, { firm, branch });
  }, [firm, branch, user]);

  // `country` rides along because it decides the currency every amount in the app is shown in
  // (useCurrency). Without it the scope object couldn't answer "NZD or AUD?".
  const selectFirm = useCallback((firmId) => {
    const f = activeFirms.find((x) => x.id === firmId);
    setFirm(f ? { id: f.id, name: f.name, country: f.country } : null);
    setBranch(null);
  }, [activeFirms]);

  const selectBranch = useCallback((branchId) => {
    const b = activeBranches.find((x) => x.id === branchId);
    setBranch(b ? { id: b.id, name: b.name } : null);
  }, [activeBranches]);

  // What the two choosers offer. A non-ROOT user's entity is their own and nothing else.
  const firmOptions = isRoot ? activeFirms : (firmQ.data ? [firmQ.data] : []);

  // "Still settling", so the dialog can show a spinner rather than an empty dropdown — a
  // firm-level user must not read "no branches" when the fetch is merely in flight, and nobody
  // should see "this entity has no active branches" before the list has arrived.
  const optionsLoading = (isRoot ? firmsQ.isLoading : firmQ.isLoading)
    || (Boolean(currentFirmId) && branchesQ.isLoading);

  const scopeComplete = Boolean(firm?.id && branch?.id);

  // Whether the question is settled enough to be worth asking. Without this a branch-level user —
  // whose scope pins itself the instant the branches query resolves — sees the blocking dialog
  // flash open and shut on every cold load.
  const scopeSettled = !optionsLoading;

  const value = useMemo(
    () => ({
      firm, setFirm, branch, setBranch,
      firmOptions, activeBranches, selectFirm, selectBranch,
      isRoot, branchLevel, branchSelectable, currentFirmId,
      optionsLoading, scopeComplete, scopeSettled,
    }),
    [firm, branch, firmOptions, activeBranches, selectFirm, selectBranch,
     isRoot, branchLevel, branchSelectable, currentFirmId,
     optionsLoading, scopeComplete, scopeSettled],
  );

  return <DashboardScopeContext.Provider value={value}>{children}</DashboardScopeContext.Provider>;
}

export function useDashboardScope() {
  const ctx = useContext(DashboardScopeContext);
  if (!ctx) throw new Error('useDashboardScope must be used within a DashboardScopeProvider');
  return ctx;
}

/**
 * Keep only the deals matching the selected firm/branch. Null = unset, which matches everything.
 *
 * <p>The branch clause matches on `firmBranchId`, not on `branchName`. It used to be the name, which
 * was survivable while `branch` was usually null and the clause rarely ran — but a branch is now
 * always set, so this runs on every dashboard, every time. Any deal whose `branchName` had drifted
 * from the name held in a saved scope (a branch renamed under someone's feet) would silently
 * vanish from every list, which reads as data loss rather than as a filter. The id cannot drift.
 *
 * <p>The firm clause stays on name because the list DTO carries no firm id — and it is redundant
 * anyway, since a branch belongs to exactly one firm.
 */
export function scopeFilterDeals(deals, { firm, branch }) {
  return (deals ?? []).filter(
    (d) => (!firm || d.firmName === firm.name) && (!branch || d.firmBranchId === branch.id),
  );
}

/** Hook form for dashboards: returns the deals narrowed to the active scope. */
export function useScopedDeals(deals) {
  const { firm, branch } = useDashboardScope();
  return useMemo(() => scopeFilterDeals(deals, { firm, branch }), [deals, firm, branch]);
}
