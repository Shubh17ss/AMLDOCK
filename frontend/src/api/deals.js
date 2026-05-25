import { apiClient } from './client.js';

export async function listDeals(params = {}) {
  const { data } = await apiClient.get('/deals', { params });
  return data;
}

export async function getDeal(id) {
  const { data } = await apiClient.get(`/deals/${id}`);
  return data;
}

export async function createDeal(payload) {
  const { data } = await apiClient.post('/deals', payload);
  return data;
}

export async function updateDeal(id, payload) {
  const { data } = await apiClient.patch(`/deals/${id}`, payload);
  return data;
}

export async function updateDealProperty(id, payload) {
  const { data } = await apiClient.patch(`/deals/${id}/property`, payload);
  return data;
}

export async function updateDealClient(id, payload) {
  const { data } = await apiClient.patch(`/deals/${id}/client`, payload);
  return data;
}

export async function deleteDeal(id) {
  await apiClient.delete(`/deals/${id}`);
}

export async function submitDeal(id) {
  const { data } = await apiClient.post(`/deals/${id}/submit`);
  return data;
}

export async function assignDeal(id) {
  const { data } = await apiClient.post(`/deals/${id}/assign`);
  return data;
}
