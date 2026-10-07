import { apiClient } from './client.js';
import { compact } from './deals.js';

/**
 * One page of the owners on the scoped firm's or branch's deals:
 * `{ items, page, size, totalElements, totalPages }`, newest first.
 *
 * The firm and branch filters are advisory: the server narrows them by the caller's role, so an
 * agent gets the people on their own deals whatever is passed.
 *
 * - `allTypes`: every kind of owner (trusts, companies...), not only natural persons. Opt-in
 *   because the owner picker offers people to copy onto a new individual, where a trust means
 *   nothing.
 * - `q`: the owner's name contains the text (3+ characters; shorter is ignored).
 * - `residence`: 'OVERSEAS' (lives outside the deal's reporting-entity country) or 'UNANSWERED'.
 * - `verification`: e.g. 'VERIFIED_WITH_EXCEPTION'.
 * - `page` (0-based), `size` (max 100).
 */
export async function listIndividuals({ allTypes, ...rest } = {}) {
  const { data } = await apiClient.get('/individuals', {
    params: compact({ ...rest, allTypes: allTypes ? true : undefined }),
  });
  return data;
}

/**
 * Downloads every row matching the same filters as `listIndividuals` as a CSV built on the
 * server, so the file holds the whole register rather than the page on screen.
 */
export async function downloadIndividualsCsv({ allTypes, filename = 'owners.csv', ...rest } = {}) {
  const { data } = await apiClient.get('/individuals/export', {
    params: compact({ ...rest, allTypes: allTypes ? true : undefined }),
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
