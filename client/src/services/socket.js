// src/services/socket.js
import { io } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';
let socket = null;

export function createSocket(token) {
  if (socket) return socket;
  socket = io(SERVER, { autoConnect: false, auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}
