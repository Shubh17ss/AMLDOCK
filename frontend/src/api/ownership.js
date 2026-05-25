import { apiClient } from './client.js';

export const NODE_TYPES = [
  { value: 'NATURAL_PERSON', label: 'Natural person' },
  { value: 'NZ_COMPANY', label: 'NZ company' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'OTHER', label: 'Other entity' },
];

export const EDGE_ROLES = [
  { value: 'TRUSTEE', label: 'Trustee' },
  { value: 'BENEFICIARY', label: 'Beneficiary' },
  { value: 'SHAREHOLDER', label: 'Shareholder' },
  { value: 'PARTNER', label: 'Partner' },
];

export const ID_DOCUMENT_TYPES = [
  { value: 'DRIVER_LICENCE', label: 'Driver licence' },
  { value: 'PASSPORT', label: 'Passport' },
];

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
