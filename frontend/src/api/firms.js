import { apiClient } from './client.js';

export async function listFirms() {
  const { data } = await apiClient.get('/firms');
  return data;
}

export async function getFirm(id) {
  const { data } = await apiClient.get(`/firms/${id}`);
  return data;
}

export async function createFirm(payload) {
  const { data } = await apiClient.post('/firms', payload);
  return data;
}

export async function updateFirm(id, payload) {
  const { data } = await apiClient.patch(`/firms/${id}`, payload);
  return data;
}

export async function listBranches(firmId) {
  const { data } = await apiClient.get(`/firms/${firmId}/branches`);
  return data;
}

export async function createBranch(firmId, payload) {
  const { data } = await apiClient.post(`/firms/${firmId}/branches`, payload);
  return data;
}

export async function updateBranch(id, payload) {
  const { data } = await apiClient.patch(`/branches/${id}`, payload);
  return data;
}

export async function deactivateBranch(id) {
  await apiClient.delete(`/branches/${id}`);
}
