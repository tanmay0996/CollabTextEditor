// src/services/socket.js
import { io } from 'socket.io-client';

const SERVER = import.meta.env.VITE_REACT_APP_SERVER_URL || 'http://localhost:8000';
let socket = null;

export function createSocket() {
  if (socket) return socket;
  socket = io(SERVER, { autoConnect: false, withCredentials: true });
  return socket;
}

export async function connectSocket() {
  const s = createSocket();
  s.connect();
  return s;
}

export function getSocket() {
  return socket;
}
