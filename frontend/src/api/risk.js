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
 * { dealId, riskValue, calculatedRating, rating, source,
 *   overrideComment, overriddenByName, overriddenAt,
 *   approved, approvedByUserId, approvedByName, approvedAt, complete,
 *   factors:    [{ code, label, points, nodeId, nodeName, countryCode }],
 *   unanswered: [{ code, label, nodeId, nodeName }] }
 * ```
 *
 * `rating` is what the deal carries; `calculatedRating` is what the answers say on their own.
 * They differ only while `source` is OVERRIDE, and the override dialog shows both.
 *
 * Bylines are names rather than emails - matching verifiedByName on the deal versions. `points`
 * still arrives on each factor and is not printed; it picks which of the three red tints the
 * card gets. `countryCode` is set only on the country factors, so the card can render a flag and
 * the country's full name.
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
 * Sets the band by hand. Passing the calculated band is an override like any other - it records
 * that a reviewer agreed with the engine deliberately, and keeps the comment and byline saying
 * so. There is no way back to a derived rating: once overridden, the band stops tracking the
 * score until somebody sets it again.
 *
 * The approval is withdrawn either way, so invalidate the deal alongside this.
 */
export async function overrideDealRisk(id, rating, comment) {
  const { data } = await apiClient.post(`/deals/${id}/risk/override`, { rating, comment });
  return data;
}
