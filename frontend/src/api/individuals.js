import { apiClient } from './client.js';

/**
 * The natural people on the scoped firm's or branch's deals.
 *
 * One read behind two registers: Beneficial Owners lists them all, Overseas Residents lists the
 * subset living somewhere other than the reporting entity's own country. The filters here are
 * advisory — the server narrows them further by the caller's role, so an agent gets the people on
 * their own deals whatever is passed.
 */
/**
 * `allTypes` widens the list from natural persons to every kind of owner — trusts, companies, the
 * lot. Opt-in rather than the default because the owner picker shares this call to offer a person
 * to copy onto a new individual, and a trust in that list means nothing.
 */
export async function listIndividuals({ firmId, branchId, allTypes } = {}) {
  const { data } = await apiClient.get('/individuals', {
    params: { firmId, branchId, ...(allTypes ? { allTypes: true } : {}) },
  });
  return data;
}

/**
 * One individual in full, by the node id a register row carries.
 *
 * The list stays deliberately thin — it feeds two registers and a CSV export — so the contact and
 * background fields are fetched only for the one person somebody actually opened.
 */
export async function getIndividual(nodeId) {
  const { data } = await apiClient.get(`/individuals/${nodeId}`);
  return data;
}
