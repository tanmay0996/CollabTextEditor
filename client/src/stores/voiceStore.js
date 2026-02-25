import { create } from 'zustand';

/**
 * Voice state machine:
 *   idle → recording → cleaning → success → idle
 *                   ↘ idle (no speech / cancelled)
 *                              ↘ error → idle
 */
export const useVoiceStore = create((set, get) => ({
    // 'idle' | 'recording' | 'cleaning' | 'success' | 'error'
    status: 'idle',
    errorMessage: '',
    interimText: '',      // live preview text while recording
    elapsedMs: 0,         // recording duration tracker
    _timerInterval: null,  // internal timer ref

    // --- Actions ---
    startRecording: () => {
        // Start elapsed timer
        const start = Date.now();
        const interval = setInterval(() => {
            set({ elapsedMs: Date.now() - start });
        }, 100);

        set({
            status: 'recording',
            errorMessage: '',
            interimText: '',
            elapsedMs: 0,
            _timerInterval: interval,
        });
    },

    stopRecording: () => {
        const { _timerInterval } = get();
        if (_timerInterval) clearInterval(_timerInterval);
        set({ status: 'idle', _timerInterval: null });
    },

    startCleaning: () => {
        const { _timerInterval } = get();
        if (_timerInterval) clearInterval(_timerInterval);
        set({ status: 'cleaning', _timerInterval: null });
    },

    finishCleaning: () => {
        set({ status: 'success' });

        // Auto-transition success → idle after 2s
        setTimeout(() => {
            if (get().status === 'success') {
                set({ status: 'idle', interimText: '' });
            }
        }, 2000);
    },

    setError: (message) => {
        const { _timerInterval } = get();
        if (_timerInterval) clearInterval(_timerInterval);
        set({
            status: 'error',
            errorMessage: message,
            _timerInterval: null,
        });

        // Auto-transition error → idle after 4s
        setTimeout(() => {
            if (get().status === 'error') {
                set({ status: 'idle', errorMessage: '' });
            }
        }, 4000);
    },

    setInterimText: (text) => set({ interimText: text }),

    reset: () => {
        const { _timerInterval } = get();
        if (_timerInterval) clearInterval(_timerInterval);
        set({
            status: 'idle',
            errorMessage: '',
            interimText: '',
            elapsedMs: 0,
            _timerInterval: null,
        });
    },
}));
