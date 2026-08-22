import { apiClient } from './client.js';
import { ID_DOCUMENT_TYPES as CATALOGUE_ID_TYPES } from './documents.js';

/**
 * The kinds of owner a structure is built from. Any may sit above or below any other, except
 * INDIVIDUAL, which is always a leaf — see `isLeafOnly` on the server's NodeType.
 *
 * Keep in sync with `nz.amldock.ownership.NodeType` and `chk_ownership_node_type` (V34).
 */
export const NODE_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'PRIVATE_COMPANY', label: 'Private company' },
  { value: 'LISTED_COMPANY', label: 'Listed company' },
  { value: 'TRUSTEE_COMPANY', label: 'Trustee company' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited partnership' },
  { value: 'INCORPORATED_SOCIETY', label: 'Incorporated society' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'GOVERNMENT_AGENCY', label: 'Government agency' },
  { value: 'DECEASED_ESTATE', label: 'Deceased estate' },
  { value: 'OTHER', label: 'Other entity' },
];

/** Superseded by PRIVATE_COMPANY in V34, kept so any stored value still renders a name. */
const LEGACY_NODE_LABELS = { NZ_COMPANY: 'Private company' };

export const nodeTypeLabel = (value) =>
  NODE_TYPES.find((t) => t.value === value)?.label
  ?? LEGACY_NODE_LABELS[value]
  ?? value
  ?? '—';

/** An individual never owns anything, so the tree offers no way to give one children. */
export const isLeafOnlyType = (value) => value === 'INDIVIDUAL';

/**
 * The capacity an individual appears in on one deal. Distinct from EDGE_ROLES below, which
 * describes a link between two nodes and carries the ownership percentage.
 *
 * Keep in sync with `nz.amldock.ownership.PersonRole` and `chk_ownership_node_person_role`.
 */
export const PERSON_ROLES = [
  { value: 'OWNER_25_PLUS', label: '25%+ ownership' },
  { value: 'TRUSTEE', label: 'Trustee' },
  { value: 'SETTLOR', label: 'Settlor' },
  { value: 'EFFECTIVE_CONTROLLER', label: 'Effective controller (director)' },
  { value: 'ACTING_ON_BEHALF_OF_CLIENT', label: 'Acting on behalf of client' },
  { value: 'APPOINTER', label: 'Appointer' },
  { value: 'EXECUTOR', label: 'Executor' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'PROTECTOR', label: 'Protector' },
  { value: 'GUARANTOR', label: 'Guarantor' },
];

export const personRoleLabel = (value) =>
  PERSON_ROLES.find((r) => r.value === value)?.label ?? value ?? '—';

export const EDGE_ROLES = [
  { value: 'TRUSTEE', label: 'Trustee' },
  { value: 'BENEFICIARY', label: 'Beneficiary' },
  { value: 'SHAREHOLDER', label: 'Shareholder' },
  { value: 'PARTNER', label: 'Partner' },
];

// The same catalogue the deal form scans from — a node's ID type and a scanned document's type
// name the same thing, so they must not drift into two lists.
export const ID_DOCUMENT_TYPES = CATALOGUE_ID_TYPES;

export async function getTree(dealId) {
  const { data } = await apiClient.get(`/deals/${dealId}/ownership`);
  return data;
}

export async function createNode(dealId, payload) {
  const { data } = await apiClient.post(`/deals/${dealId}/ownership/nodes`, payload);
  return data;
}

export async function updateNode(dealId, nodeId, payload) {
  const { data } = await apiClient.patch(`/deals/${dealId}/ownership/nodes/${nodeId}`, payload);
  return data;
}

export async function deleteNode(dealId, nodeId, { force = false } = {}) {
  await apiClient.delete(`/deals/${dealId}/ownership/nodes/${nodeId}`, {
    params: force ? { force: true } : undefined,
  });
}

export async function createEdge(dealId, payload) {
  const { data } = await apiClient.post(`/deals/${dealId}/ownership/edges`, payload);
  return data;
}

export async function updateEdge(dealId, edgeId, payload) {
  const { data } = await apiClient.patch(`/deals/${dealId}/ownership/edges/${edgeId}`, payload);
  return data;
}

export async function deleteEdge(dealId, edgeId) {
  await apiClient.delete(`/deals/${dealId}/ownership/edges/${edgeId}`);
}

export async function setRoot(dealId, nodeId) {
  const { data } = await apiClient.post(`/deals/${dealId}/ownership/root`, { nodeId });
  return data;
}
