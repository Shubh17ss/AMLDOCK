import { apiClient } from './client.js';

// The assurance register: compliance's second look at deals it has already signed off.
//
// A mark sits on a version, not on the deal, because a sign-off is per version. Only the current
// position is kept on the version; every change also lands in the audit log.

/**
 * Every verified or closed deal in scope, each as `{ deal, versions }`. `deal` is the deals list's
 * own row; `versions` are newest first, each with its `assuranceStatus` (null = not reviewed).
 */
export async function listAssurance({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/assurance', { params: { firmId, branchId } });
  return data;
}

/** Marks a version assured. The note is required, three characters at least. */
export async function assureVersion(dealId, versionNo, note) {
  const { data } = await apiClient.post(`/deals/${dealId}/versions/${versionNo}/assure`, { note });
  return data;
}

/** Withdraws assurance from an assured version, saying why. */
export async function unassureVersion(dealId, versionNo, note) {
  const { data } = await apiClient.post(`/deals/${dealId}/versions/${versionNo}/unassure`, { note });
  return data;
}
