import { apiClient } from './client.js';

export async function listUsers({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/users', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
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

/* ---------- your own account ---------- */
// Separate from updateUser above, which is a manager acting on somebody else. These need no id:
// the server takes the subject from the session, so there is nothing here to get wrong.

/**
 * Changes your own display name. Returns the refreshed session (the same shape as `/auth/me`),
 * so callers can hand it straight to the auth context instead of re-fetching.
 */
export async function updateMyProfile(payload) {
  const { data } = await apiClient.patch('/users/me', payload);
  return data;
}

/**
 * Step 1 of changing your sign-in email: sends a code to the new address.
 *
 * Nothing on the account moves until {@link verifyEmailChange} succeeds — the current address goes
 * on working, so abandoning this halfway costs nothing.
 */
export async function requestEmailChange(newEmail) {
  await apiClient.post('/users/me/email-change', { newEmail });
}

/**
 * Step 2: the code from the new address. The address itself is deliberately not sent — the server
 * reads it from the code it issued, so a code earned on one address can't move you to another.
 */
export async function verifyEmailChange(code) {
  const { data } = await apiClient.post('/users/me/email-change/verify', { code });
  return data;
}
