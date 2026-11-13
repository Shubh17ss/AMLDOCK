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

// Off-boarding (ROOT only). Deactivating signs the branch's staff out and makes it read-only;
// reactivating brings back the staff its deactivation switched off.
export async function deactivateBranch(ref) {
  const { data } = await apiClient.post(`/branches/${ref}/deactivate`);
  return data;
}

export async function activateBranch(ref) {
  const { data } = await apiClient.post(`/branches/${ref}/activate`);
  return data;
}

export async function getBranchDeletionPreview(ref) {
  const { data } = await apiClient.get(`/branches/${ref}/deletion-preview`);
  return data;
}

/** Irreversible. `confirmName` is the branch name as typed by the person confirming. */
export async function deleteBranch(ref, confirmName) {
  await apiClient.delete(`/branches/${ref}`, { data: { confirmName } });
}

// Reporting entity off-boarding (ROOT only). Deactivating closes every branch in it and leaves its
// compliance officers and senior managers read-only; reactivating brings back what it closed.
export async function deactivateFirm(ref) {
  const { data } = await apiClient.post(`/firms/${ref}/deactivate`);
  return data;
}

export async function activateFirm(ref) {
  const { data } = await apiClient.post(`/firms/${ref}/activate`);
  return data;
}

export async function getFirmDeletionPreview(ref) {
  const { data } = await apiClient.get(`/firms/${ref}/deletion-preview`);
  return data;
}

/** Irreversible. `confirmName` is the entity's name as typed by the person confirming. */
export async function deleteFirm(ref, confirmName) {
  await apiClient.delete(`/firms/${ref}`, { data: { confirmName } });
}
