import { apiClient } from './client.js';

export async function listDeals(params = {}) {
  const { data } = await apiClient.get('/deals', { params });
  return data;
}

export async function getDeal(id) {
  const { data } = await apiClient.get(`/deals/${id}`);
  return data;
}

export async function createDeal(payload) {
  const { data } = await apiClient.post('/deals', payload);
  return data;
}

export async function updateDeal(id, payload) {
  const { data } = await apiClient.patch(`/deals/${id}`, payload);
  return data;
}

export async function updateDealProperty(id, payload) {
  const { data } = await apiClient.patch(`/deals/${id}/property`, payload);
  return data;
}

export async function updateDealClient(id, payload) {
  const { data } = await apiClient.patch(`/deals/${id}/client`, payload);
  return data;
}

export async function deleteDeal(id) {
  await apiClient.delete(`/deals/${id}`);
}

/* ---------- lifecycle ---------- */
// One call per verb, mirroring the endpoints. The server owns the rules — see
// data/dealStatus.js for the predicates that decide which of these to offer.

/** NEW → REVIEW. The broker has finished; the deal passes straight to compliance. */
export async function submitDealForReview(id) {
  const { data } = await apiClient.post(`/deals/${id}/submit`);
  return data;
}

/** REVIEW → ON_HOLD. */
export async function holdDeal(id, note) {
  const { data } = await apiClient.post(`/deals/${id}/hold`, { note });
  return data;
}

/** REVIEW → VERIFIED. */
export async function verifyDeal(id, note) {
  const { data } = await apiClient.post(`/deals/${id}/verify`, { note });
  return data;
}

/**
 * VERIFIED → REVIEW. Takes a signed-off deal back for changes.
 *
 * The server writes the version *before* the deal moves, so what was signed off is untouched by
 * anything done after this returns. Invalidate ['dealVersions', id] alongside the deal.
 */
export async function reopenDeal(id, note) {
  const { data } = await apiClient.post(`/deals/${id}/reopen`, { note });
  return data;
}

/** VERIFIED → CLOSED. */
export async function closeDeal(id) {
  const { data } = await apiClient.post(`/deals/${id}/close`);
  return data;
}

/** REVIEW | ON_HOLD → NEW, handing edit rights back to the broker. */
export async function revertDeal(id, note) {
  const { data } = await apiClient.post(`/deals/${id}/revert`, { note });
  return data;
}

export async function overrideDeal(id, targetStatus, reason) {
  const { data } = await apiClient.post(`/deals/${id}/override`, { targetStatus, reason });
  return data;
}

/* ---------- notes timeline ---------- */

/** The whole thread: the broker's opening note, comments, and one entry per state change. */
export async function listDealNotes(id) {
  const { data } = await apiClient.get(`/deals/${id}/notes`);
  return data;
}

/** Posts a comment. Returns the refreshed timeline. */
export async function addDealNote(id, note) {
  const { data } = await apiClient.post(`/deals/${id}/notes`, { note });
  return data;
}
