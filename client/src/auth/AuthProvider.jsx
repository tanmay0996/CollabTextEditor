import React from 'react';
import api from '@/services/api';
import { saveToken, getToken, clearToken } from '@/utils/auth';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = React.useState('unknown');
  const [user, setUser] = React.useState(null);

  const logout = React.useCallback(() => {
    try {
      clearToken();
    } catch {
      void 0;
    }
    setUser(null);
    setStatus('unauthenticated');
    try {
      window.dispatchEvent(new Event('auth:logout'));
    } catch {
      void 0;
    }
  }, []);

  const validate = React.useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    try {
      const res = await api.get('/auth/me');
      setUser(res.data || null);
      setStatus('authenticated');
    } catch (err) {
      if (err?.response?.status === 401) {
        logout();
        return;
      }
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [logout]);

  React.useEffect(() => {
    void validate();
  }, [validate]);

  React.useEffect(() => {
    function onLogout() {
      setUser(null);
      setStatus('unauthenticated');
    }

    function onLogin() {
      void validate();
    }

    window.addEventListener('auth:logout', onLogout);
    window.addEventListener('auth:login', onLogin);
    return () => {
      window.removeEventListener('auth:logout', onLogout);
      window.removeEventListener('auth:login', onLogin);
    };
  }, [validate]);

  const login = React.useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const token = res.data?.token;
    const u = res.data?.user || null;

    if (!token) {
      const err = new Error('NO_TOKEN');
      err.code = 'NO_TOKEN';
      throw err;
    }

    saveToken(token);
    setUser(u);
    setStatus('authenticated');

    try {
      window.dispatchEvent(new Event('auth:login'));
    } catch {
      void 0;
    }

    return { token, user: u };
  }, []);

  const value = React.useMemo(
    () => ({ status, user, login, logout, validate }),
    [status, user, login, logout, validate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
