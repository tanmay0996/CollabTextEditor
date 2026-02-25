import { create } from 'zustand';

export const useVoiceStore = create((set, get) => ({
    // 'idle' | 'recording' | 'cleaning'
    status: 'idle',

    setStatus: (status) => set({ status }),
    startRecording: () => set({ status: 'recording' }),
    stopRecording: () => set({ status: 'idle' }),
    startCleaning: () => set({ status: 'cleaning' }),
    finishCleaning: () => set({ status: 'idle' }),
    reset: () => set({ status: 'idle' }),
}));
