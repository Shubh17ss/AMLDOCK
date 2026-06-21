import { apiClient } from './client.js';

export async function listUsers() {
  const { data } = await apiClient.get('/users');
  return data;
}

export async function createUser(payload) {
  const { data } = await apiClient.post('/users', payload);
  return data;
}

export async function bulkCreateUsers(payload) {
  const { data } = await apiClient.post('/users/bulk', payload);
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await apiClient.patch(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id) {
  await apiClient.delete(`/users/${id}`);
}

export async function resetUserPassword(id, newPassword) {
  await apiClient.post(`/users/${id}/reset-password`, { newPassword });
}
