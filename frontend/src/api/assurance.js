import { apiClient } from './client.js';
import { compact } from './deals.js';

// The assurance register: compliance's second look at deals it has already signed off.
//
// A verdict sits on a version, not on the deal, because a sign-off is per version: ASSURED
// (passed), ACTION_REQUIRED with the issues found and their planned remediation, or null while
// nobody has reviewed it. Only the current verdict is kept; every change lands in the audit log.

/**
 * One page of the register: every verified or closed deal in scope as `{ deal, latestVersion }`.
 * `deal` is the deals list's own row; `latestVersion` is the version the deal stands on (null if
 * it has none). Older versions are read from the deal's version history.
 *
 * - `from` / `to`: ISO instants, either optional. A deal is included if its latest version was
 *   verified in the range, or the deal was closed in the range.
 * - `q`: reference, client name or property address.
 * - `assurance`: 'AWAITING' | 'ASSURED' | 'ACTION_REQUIRED', on the latest version's verdict.
 * - `page` (0-based), `size` (max 100).
 */
export async function listAssurance(params = {}) {
  const { data } = await apiClient.get('/assurance', { params: compact(params) });
  return data;
}

/**
 * Records the result of an assurance. `status` is 'ASSURED' or 'ACTION_REQUIRED'; `issues` is
 * `[{ issue, remediation }]`, required for ACTION_REQUIRED and empty for ASSURED. The list
 * replaces whatever was recorded before.
 */
export async function updateAssurance(dealId, versionNo, { status, issues = [] }) {
  const { data } = await apiClient.put(`/deals/${dealId}/versions/${versionNo}/assurance`, {
    status, issues,
  });
  return data;
}
