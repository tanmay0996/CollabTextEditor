// src/services/api.js
import axios from 'axios';

const SERVER = import.meta.env.VITE_REACT_APP_SERVER_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: SERVER + '/api' });

// set auth header helper
export function setAuthToken(token) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete api.defaults.headers.common['Authorization'];
}

export default api;
