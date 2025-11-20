// src/utils/auth.js
export function saveToken(token) {
  if (!token) return;
  localStorage.setItem('token', token);
}
export function getToken() {
  return localStorage.getItem('token');
}
export function clearToken() {
  localStorage.removeItem('token');
}
