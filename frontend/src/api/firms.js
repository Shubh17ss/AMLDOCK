import { apiClient } from './client.js';

// Firms and branches are named in these paths by their public id (`publicId` on the DTOs), not
// the numeric `id` the other APIs filter by.

export async function listFirms() {
  const { data } = await apiClient.get('/firms');
  return data;
}

export async function getFirm(ref) {
  const { data } = await apiClient.get(`/firms/${ref}`);
  return data;
}

export async function createFirm(payload) {
  const { data } = await apiClient.post('/firms', payload);
  return data;
}

export async function updateFirm(ref, payload) {
  const { data } = await apiClient.patch(`/firms/${ref}`, payload);
  return data;
}

export async function listBranches(firmRef) {
  const { data } = await apiClient.get(`/firms/${firmRef}/branches`);
  return data;
}

export async function createBranch(firmRef, payload) {
  const { data } = await apiClient.post(`/firms/${firmRef}/branches`, payload);
  return data;
}

export async function updateBranch(ref, payload) {
  const { data } = await apiClient.patch(`/branches/${ref}`, payload);
  return data;
}

export async function deactivateBranch(ref) {
  await apiClient.delete(`/branches/${ref}`);
}
