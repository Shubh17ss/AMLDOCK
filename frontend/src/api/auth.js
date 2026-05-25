import { apiClient } from './client.js';

export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}

export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

export async function changePassword(currentPassword, newPassword) {
  await apiClient.post('/users/me/change-password', { currentPassword, newPassword });
}
