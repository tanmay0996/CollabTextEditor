import React from 'react';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setStatus = useAuthStore((s) => s.setStatus);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const validate = React.useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const u = res.data?.user || null;
      if (u) {
        setUser(u);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [setStatus, setUser]);

  React.useEffect(() => {
    void validate();
  }, [validate]);

  const login = React.useCallback(
    async (email, password) => {
      const res = await api.post('/auth/login', { email, password });
      const u = res.data?.user || null;
      setUser(u);
      setStatus('authenticated');
      return { user: u };
    },
    [setStatus, setUser]
  );

  const value = React.useMemo(() => ({ status, user, login, logout, validate }), [status, user, login, logout, validate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
