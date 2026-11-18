// Where the dashboard's firm/branch selection is persisted.
//
// Split out of DashboardScope.jsx so AuthContext can clear the selection on sign-out without
// importing the provider — DashboardScope consumes AuthContext, so importing it back would be a
// cycle. This module depends on nothing, which is what lets both sides use it.

// `userId`, the field the session actually carries (AuthResponse.userId). This read `user.id`,
// which is always undefined, so every key silently fell back to the email, and an account
// re-created with the same address inherited the deleted one's firm and branch.
const keyFor = (user) => `amldock.dashScope.${user?.userId ?? user?.email ?? 'anon'}`;

// Two copies. sessionStorage is this tab's own, so a reload keeps the scope it was working in even
// after another tab switched. localStorage is only the starting point for a tab that has none yet:
// the last scope anyone chose. Tabs used to share the one localStorage copy, so a switch in one
// silently decided where every other tab landed on its next reload.
function readFrom(storage, user) {
  try {
    const raw = storage.getItem(keyFor(user));
    if (raw) {
      const saved = JSON.parse(raw);
      return { firm: saved.firm ?? null, branch: saved.branch ?? null, initialized: true };
    }
  } catch { /* corrupt or unavailable storage — fall through */ }
  return null;
}

export function readSavedScope(user) {
  return readFrom(sessionStorage, user)
    ?? readFrom(localStorage, user)
    ?? { firm: null, branch: null, initialized: false };
}

export function writeSavedScope(user, { firm, branch }) {
  const raw = JSON.stringify({ firm, branch });
  try { sessionStorage.setItem(keyFor(user), raw); } catch { /* ignore */ }
  try { localStorage.setItem(keyFor(user), raw); } catch { /* ignore */ }
}

/**
 * Forgets the saved selection.
 *
 * <p>Called on sign-out, because the key is derived from the user id and ids are not
 * unique over time — a reseeded or renumbered account inherits whatever the previous holder of
 * that id had selected, and the scope would name an entity the new user may not even be in.
 */
export function clearSavedScope(user) {
  try { sessionStorage.removeItem(keyFor(user)); } catch { /* ignore */ }
  try { localStorage.removeItem(keyFor(user)); } catch { /* ignore */ }
}
