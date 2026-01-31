// src/services/api.js
import axios from 'axios';
import { navigateTo } from '@/services/navigation';
import { useAuthStore } from '@/stores/authStore';

const SERVER = import.meta.env.VITE_REACT_APP_SERVER_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: SERVER + '/api', withCredentials: true });

let handling401 = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !handling401) {
      handling401 = true;
      try { useAuthStore.getState().logoutLocal(); } catch { void 0; }

      navigateTo('/login', { replace: true });
      setTimeout(() => {
        handling401 = false;
      }, 0);
    }
    return Promise.reject(err);
  }
);

export default api;
