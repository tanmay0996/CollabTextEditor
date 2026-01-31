// src/services/api.js
import axios from 'axios';
import { getToken, clearToken } from '@/utils/auth';
import { navigateTo } from '@/services/navigation';

const SERVER = import.meta.env.VITE_REACT_APP_SERVER_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: SERVER + '/api' });

let handling401 = false;

api.interceptors.request.use((config) => {
  const token = getToken();
  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !handling401) {
      handling401 = true;
      try {
        clearToken();
      } catch {
        void 0;
      }

      try {
        window.dispatchEvent(new Event('auth:logout'));
      } catch {
        void 0;
      }

      navigateTo('/login', { replace: true });
      setTimeout(() => {
        handling401 = false;
      }, 0);
    }
    return Promise.reject(err);
  }
);

// set auth header helper
export function setAuthToken(token) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
}

export default api;
