import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardScope } from './DashboardScope.jsx';
import { listBranches } from '../api/firms.js';

// The minimum hold behind a switch, and how long its result stays up.
const SWITCH_HOLD_MS = 1500;
const RESULT_MS = 1200;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * The one way to change the scope after it is set.
 *
 * A switch is confirmed with the server before it is applied: the entity's branches are fetched
 * fresh behind a hold of at least SWITCH_HOLD_MS, and only a branch that comes back active is
 * switched to. Anything else leaves the scope as it was. Render `switching` through
 * ScopeSwitchOverlay.
 *
 * `onSwitched(firm, branch)` runs once the new scope is applied, before the result tick clears —
 * the sidebar uses it to leave whatever entity page was open, the deal guard does not.
 *
 * Shared by ScopeSelector and useDealScopeGuard, so a deal link can never move the scope by a
 * route the selector would have refused (an inactive branch, an entity gone since the link was made).
 */
export function useScopeSwitch({ onSwitched } = {}) {
  const { firm, branch, currentFirmRef, selectScope } = useDashboardScope();
  const qc = useQueryClient();
  const [switching, setSwitching] = useState(null);   // { phase, branchName, error }
  // Set on every mount, not just initialised: StrictMode mounts, unmounts and mounts again, and a
  // flag only ever cleared would read "gone" for good and leave the overlay stuck on its spinner.
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const onSwitchedRef = useRef(onSwitched);
  onSwitchedRef.current = onSwitched;

  /**
   * `pickedFirm` needs `publicId` to list its branches; omit it to stay in the current entity.
   * Resolves true once switched.
   */
  const switchTo = useCallback(async (pickedFirm, pickedBranch) => {
    if (pickedBranch.id === branch?.id && (!pickedFirm || pickedFirm.id === firm?.id)) return true;
    const firmRef = pickedFirm ? pickedFirm.publicId : currentFirmRef;
    setSwitching({ phase: 'switching', branchName: pickedBranch.name });

    let fresh = null;
    let error = null;
    const [result] = await Promise.allSettled([
      qc.fetchQuery({
        queryKey: ['firms', firmRef, 'branches'],
        queryFn: () => listBranches(firmRef),
        staleTime: 0,
      }),
      sleep(SWITCH_HOLD_MS),
    ]);
    if (!firmRef) {
      error = 'That reporting entity is no longer available.';
    } else if (result.status === 'fulfilled') {
      fresh = result.value.find((b) => b.id === pickedBranch.id && b.active) ?? null;
      if (!fresh) error = 'That branch is no longer active.';
    } else {
      error = result.reason?.response?.data?.message || 'The server could not be reached. Try again.';
    }
    if (!alive.current) return false;

    const nextFirm = pickedFirm ?? firm;
    if (fresh) {
      // The fetched row, not a lookup in `branchOptions`, which may predate the fetch.
      selectScope(nextFirm, fresh);
      setSwitching({ phase: 'done', branchName: fresh.name });
      onSwitchedRef.current?.(nextFirm, fresh);
    } else {
      setSwitching({ phase: 'failed', branchName: pickedBranch.name, error });
    }
    await sleep(RESULT_MS);
    if (alive.current) setSwitching(null);
    return Boolean(fresh);
  }, [firm, branch, currentFirmRef, selectScope, qc]);

  return { switching, switchTo };
}

/**
 * Queries keyed by one deal rather than by scope. Scope-keyed lists refetch on their own when the
 * scope changes; these would go on serving the old branch's deal to the next screen that asks.
 * The whole `['deals']` family goes, lists included: those are scope-keyed and refetch anyway, and
 * telling `['deals', id, …]` from `['deals', 'summary', …]` by shape is not worth the fragility.
 */
export function dropEntityQueries(qc) {
  qc.removeQueries({ queryKey: ['deals'] });
  qc.removeQueries({ queryKey: ['dealVersions'] });
  qc.removeQueries({ queryKey: ['ownership'] });
}
