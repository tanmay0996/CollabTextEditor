import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  status: 'unknown',
  user: null,

  setStatus: (status) => set({ status }),
  setUser: (user) => set({ user }),

  logoutLocal: () => set({ status: 'unauthenticated', user: null }),

  logout: async () => {
    try {
      const api = (await import('@/services/api')).default;
      await api.post('/auth/logout');
    } catch {
      void 0;
    }
    set({ status: 'unauthenticated', user: null });
  },
}));
