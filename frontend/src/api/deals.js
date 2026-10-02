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

/**
 * Every move between Verified and Closed, newest first: `[{ kind, fromStatus, toStatus, fromAt,
 * occurredAt, versionNo, valuationMin, valuationMax, propertySold, saleTotal, variance, note,
 * actorName }]`. `variance` is 'WITHIN', 'BEYOND' or null.
 */
export async function getTransactionMonitoring(id) {
  const { data } = await apiClient.get(`/deals/${id}/transaction-monitoring`);
  return data;
}

/**
 * Whether the deal could be verified now: `{ ready, missing: [label, ...] }`. The verify and
 * override endpoints enforce the same answer; this only lets the dialog say it first.
 */
export async function getVerificationReadiness(id) {
  const { data } = await apiClient.get(`/deals/${id}/verification-readiness`);
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

/**
 * VERIFIED → CLOSED, recording what the deal finished as.
 *
 * The one status verb that carries something other than a note. `payload` is
 * `{ propertySold, salePrice?, units? }`: a single price for most properties, or a row per unit
 * for a development. Which of the two the server will accept is decided by the deal's own
 * property type, not by what is sent.
 */
export async function closeDeal(id, payload) {
  const { data } = await apiClient.post(`/deals/${id}/close`, payload);
  return data;
}

/**
 * CLOSED → VERIFIED. Takes a closed deal back so its sale detail can be corrected.
 *
 * Not `reopenDeal`, which lands in REVIEW because a reopened sign-off is compliance's to redo.
 * Nothing here questions the verification, so it writes no version and leaves the original
 * sign-off stamp alone — closing again is how the figures get replaced.
 */
export async function uncloseDeal(id, note) {
  const { data } = await apiClient.post(`/deals/${id}/unclose`, { note });
  return data;
}

/** What the deal finished as — whether it sold, for how much, and per unit for a development. */
export async function getDealSale(id) {
  const { data } = await apiClient.get(`/deals/${id}/sale`);
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
