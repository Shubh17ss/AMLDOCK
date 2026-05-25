import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;
let onUnauthorized = null;

export function setOnUnauthorized(handler) {
  onUnauthorized = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!error.response || original?._retry) {
      return Promise.reject(error);
    }
    const url = original.url || '';
    if (error.response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = apiClient.post('/auth/refresh').finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
        return apiClient(original);
      } catch (refreshErr) {
        if (onUnauthorized) onUnauthorized();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  },
);
