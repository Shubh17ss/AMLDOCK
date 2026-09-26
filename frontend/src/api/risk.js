import { apiClient } from './client.js';

/**
 * The deal's risk position and the workings behind it.
 *
 * <p>A read of its own rather than a slice of the DealDto, because the workings are a list per
 * owner and would bloat every deal list that only wants the band. The deal still carries
 * `riskRating`, `riskValue` and `riskApproved` for the header chips.
 *
 * Shape:
 * ```
 * { dealId, riskValue, calculatedRating, rating, source, overrideComment,
 *   approved, approvedByUserId, approvedByEmail, approvedAt, complete,
 *   factors:    [{ code, label, points, nodeId, nodeName }],
 *   unanswered: [{ code, label, nodeId, nodeName }] }
 * ```
 *
 * `rating` is what the deal carries; `calculatedRating` is what the answers say on their own.
 * They differ only while `source` is OVERRIDE, and the override dialog shows both.
 */
export async function getDealRisk(id) {
  const { data } = await apiClient.get(`/deals/${id}/risk`);
  return data;
}

/**
 * Signs off the current position. Refused with a 400 while `complete` is false, so the caller
 * should keep the button disabled rather than relying on the error.
 */
export async function approveDealRisk(id) {
  const { data } = await apiClient.post(`/deals/${id}/risk/approve`);
  return data;
}

/**
 * Sets the band by hand. Passing the calculated band releases the override instead of pinning
 * it, which is the only way back to a derived rating.
 *
 * Either way the approval is withdrawn, so invalidate the deal alongside this.
 */
export async function overrideDealRisk(id, rating, comment) {
  const { data } = await apiClient.post(`/deals/${id}/risk/override`, { rating, comment });
  return data;
}
