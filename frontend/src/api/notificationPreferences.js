import { apiClient } from './client.js';

// Who gets emailed about deal activity. Two surfaces over one store: /me is the Profile card that
// every user has, the rest is the Settings matrix that officers use to manage their firm.

export async function getMyNotificationPreferences() {
  const { data } = await apiClient.get('/notification-preferences/me');
  return data;
}

/** @param preferences [{ firmBranchId, eventType, enabled }] — batched so one save is one request. */
export async function updateMyNotificationPreferences(preferences) {
  const { data } = await apiClient.put('/notification-preferences/me', { preferences });
  return data;
}

/** Everyone in one branch, for the Settings matrix. */
export async function listNotificationPreferences(branchId) {
  const { data } = await apiClient.get('/notification-preferences', { params: { branchId } });
  return data;
}

export async function updateUserNotificationPreferences(userId, preferences) {
  const { data } = await apiClient.put(`/notification-preferences/user/${userId}`, { preferences });
  return data;
}
