// Where the dashboard's firm/branch selection is persisted.
//
// Split out of DashboardScope.jsx so AuthContext can clear the selection on sign-out without
// importing the provider — DashboardScope consumes AuthContext, so importing it back would be a
// cycle. This module depends on nothing, which is what lets both sides use it.

const keyFor = (user) => `amldock.dashScope.${user?.id ?? user?.email ?? 'anon'}`;

export function readSavedScope(user) {
  try {
    const raw = localStorage.getItem(keyFor(user));
    if (raw) {
      const saved = JSON.parse(raw);
      return { firm: saved.firm ?? null, branch: saved.branch ?? null, initialized: true };
    }
  } catch { /* corrupt or unavailable storage — fall through to defaults */ }
  return { firm: null, branch: null, initialized: false };
}

export function writeSavedScope(user, { firm, branch }) {
  try { localStorage.setItem(keyFor(user), JSON.stringify({ firm, branch })); } catch { /* ignore */ }
}

/**
 * Forgets the saved selection.
 *
 * <p>Called on sign-out, because the key is derived from the user id and ids are not
 * unique over time — a reseeded or renumbered account inherits whatever the previous holder of
 * that id had selected, and the scope would name an entity the new user may not even be in.
 */
export function clearSavedScope(user) {
  try { localStorage.removeItem(keyFor(user)); } catch { /* ignore */ }
}
