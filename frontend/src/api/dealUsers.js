import { apiClient } from './client.js';

/**
 * Who can open one deal.
 *
 * <p>An agent sees only the deals they created, which is the right default and a dead end when two
 * of them work one file. These calls are the exception: a row here lets a colleague in, and its
 * absence leaves the existing rules untouched.
 */

/** The deal's author plus everyone added to it. Branch managers and compliance are not listed. */
export async function listDealUsers(dealId) {
  const { data } = await apiClient.get(`/deals/${dealId}/users`);
  return data;
}

/**
 * Branch agents not already on the deal.
 *
 * Its own endpoint rather than `/users`, which agents may not call — without it a broker could not
 * share their own deal.
 */
export async function listDealUserCandidates(dealId) {
  const { data } = await apiClient.get(`/deals/${dealId}/users/candidates`);
  return data;
}

/** Adds several at once and returns the whole list back, so callers need no second request. */
export async function addDealUsers(dealId, userIds) {
  const { data } = await apiClient.post(`/deals/${dealId}/users`, { userIds });
  return data;
}

export async function removeDealUser(dealId, userId) {
  await apiClient.delete(`/deals/${dealId}/users/${userId}`);
}
