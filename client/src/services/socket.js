// src/services/socket.js
import { io } from 'socket.io-client';
import { getToken } from '@/utils/auth';

const SERVER = import.meta.env.VITE_REACT_APP_SERVER_URL || 'http://localhost:8000';
let socket = null;

export function createSocket() {
  if (socket) return socket;
  socket = io(SERVER, { autoConnect: false, auth: { token: null } });
  return socket;
}

export async function connectSocket() {
  const s = createSocket();
  try {
    const token = getToken();
    s.auth = { token: token || null };
  } catch {
    s.auth = { token: null };
  }
  s.connect();
  return s;
}

export function getSocket() {
  return socket;
}
