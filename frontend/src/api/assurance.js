import { apiClient } from './client.js';

// The assurance register: compliance's second look at deals it has already signed off.
//
// A verdict sits on a version, not on the deal, because a sign-off is per version: ASSURED
// (passed), ACTION_REQUIRED with the issues found and their planned remediation, or null while
// nobody has reviewed it. Only the current verdict is kept; every change lands in the audit log.

/**
 * Every verified or closed deal in scope, each as `{ deal, lastAssuredAt, versions }`. `deal` is
 * the deals list's own row; `versions` are newest first.
 *
 * `from` / `to` are ISO instants, either optional. A version is included if it was verified in the
 * range, or if it is the deal's latest version and the deal was closed in the range.
 */
export async function listAssurance({ firmId, branchId, from, to } = {}) {
  const { data } = await apiClient.get('/assurance', { params: { firmId, branchId, from, to } });
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
