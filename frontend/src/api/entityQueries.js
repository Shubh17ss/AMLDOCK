import { apiClient } from './client.js';

// Change requests from a reporting entity's staff to the AMLDOCK admin team (Workspace › Queries).
// Raised by a compliance officer or senior manager about their own entity; the rest is ROOT's.

export async function raiseQuery({ message }) {
  const { data } = await apiClient.post('/entity-queries', { message });
  return data;
}

export async function listQueries() {
  const { data } = await apiClient.get('/entity-queries');
  return data;
}

export async function resolveQuery(id) {
  await apiClient.post(`/entity-queries/${id}/resolve`);
}

export async function deleteQuery(id) {
  await apiClient.delete(`/entity-queries/${id}`);
}
