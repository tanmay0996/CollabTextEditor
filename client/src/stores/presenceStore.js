import { create } from 'zustand';

export const usePresenceStore = create((set) => ({
  users: [],
  cursors: {},

  setPresence: (users) =>
    set(() => {
      const nextCursors = {};
      for (const u of users || []) {
        if (u?.id) nextCursors[u.id] = u.cursorPos || null;
      }
      return { users: users || [], cursors: nextCursors };
    }),

  updateCursor: (userId, cursorPos) =>
    set((state) => ({
      cursors: { ...state.cursors, [userId]: cursorPos || null },
    })),

  removeUser: (userId) =>
    set((state) => {
      const users = state.users.filter((u) => u?.id !== userId);
      const cursors = { ...state.cursors };
      delete cursors[userId];
      return { users, cursors };
    }),

  resetPresence: () => set({ users: [], cursors: {} }),
}));
