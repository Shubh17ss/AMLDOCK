import { apiClient } from './client.js';

// --- Email + OTP login (all roles except ROOT) ---
export async function requestOtp(email) {
  await apiClient.post('/auth/otp/request', { email });
}

export async function verifyOtp(email, code) {
  const { data } = await apiClient.post('/auth/otp/verify', { email, code });
  return data;
}

// --- ROOT password + OTP login (dedicated route) ---
export async function adminLogin(email, password) {
  await apiClient.post('/auth/admin/login', { email, password });
}

export async function adminVerify(email, code) {
  const { data } = await apiClient.post('/auth/admin/verify', { email, code });
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
