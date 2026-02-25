// client/src/services/voice.js
import { voiceLogger } from '@/utils/voiceLogger';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/** Check if the browser supports the Web Speech API */
export function isSpeechSupported() {
    return Boolean(SpeechRecognition);
}

/** Supported browser list for error messaging */
export const SUPPORTED_BROWSERS = 'Chrome, Edge, or Safari';

/**
 * VoiceRecorder — wraps the Web Speech API with callbacks.
 *
 * Callbacks:
 *   onInterim(displayText)  — called rapidly as user speaks
 *   onFinal(rawText)        — called once when recognition ends with speech
 *   onCancel()              — called when user explicitly cancels (no text kept)
 *   onError(message)        — called on mic/permission/recognition errors
 *   onStatusChange(status)  — 'recording' | 'idle'
 */
export class VoiceRecorder {
    constructor({ onInterim, onFinal, onCancel, onError, onStatusChange }) {
        this.onInterim = onInterim;
        this.onFinal = onFinal;
        this.onCancel = onCancel || (() => { });
        this.onError = onError;
        this.onStatusChange = onStatusChange || (() => { });
        this.recognition = null;
        this.finalTranscript = '';
        this.cancelled = false;
        this.stopped = false;

        // Debounce: prevent rapid start/stop (< 300ms apart)
        this._lastToggle = 0;
    }

    start(lang = 'en-US') {
        // Debounce guard
        const now = Date.now();
        if (now - this._lastToggle < 300) {
            voiceLogger.debug('recognition:debounced');
            return false;
        }
        this._lastToggle = now;

        if (!SpeechRecognition) {
            this.onError(`Speech recognition is not supported. Use ${SUPPORTED_BROWSERS}.`);
            return false;
        }

        voiceLogger.info('mic:requesting');

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = lang;
        this.finalTranscript = '';
        this.cancelled = false;
        this.stopped = false;

        this.recognition.onstart = () => {
            voiceLogger.info('recognition:start');
            this.onStatusChange('recording');
        };

        this.recognition.onresult = (event) => {
            if (this.cancelled) return;  // ignore results after cancel

            let interim = '';
            let newFinal = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    newFinal += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (newFinal) {
                this.finalTranscript += newFinal;
                voiceLogger.debug('recognition:finalChunk', { len: newFinal.length });
            }

            // Combined display: all final chunks + current interim
            const displayText = this.finalTranscript + interim;
            if (displayText) {
                this.onInterim(displayText);
            }
        };

        this.recognition.onerror = (event) => {
            voiceLogger.warn('recognition:error', { error: event.error });

            const errorMap = {
                'not-allowed': 'Microphone access denied. Enable it in your browser settings.',
                'permission-denied': 'Microphone access denied. Enable it in your browser settings.',
                'no-speech': null, // not a real error — user just didn't speak
                'aborted': null,   // expected when we call .stop() or .abort()
                'network': 'Network error during speech recognition. Check your connection.',
                'audio-capture': 'No microphone detected. Please connect a mic and try again.',
                'service-not-allowed': `Speech recognition service unavailable. Use ${SUPPORTED_BROWSERS}.`,
            };

            const message = errorMap[event.error];
            if (message === null) {
                voiceLogger.debug('recognition:ignoredError', { error: event.error });
                return; // silently ignore
            }

            this.onError(message || `Speech recognition error: ${event.error}`);
        };

        this.recognition.onend = () => {
            voiceLogger.info('recognition:end', {
                finalLen: this.finalTranscript.length,
                stopped: this.stopped,
                cancelled: this.cancelled,
            });

            if (this.cancelled) {
                // User explicitly cancelled — discard everything
                this.onCancel();
            } else if (this.finalTranscript.trim()) {
                // Normal end with speech captured
                this.onFinal(this.finalTranscript.trim());
            }

            this.onStatusChange('idle');
        };

        try {
            this.recognition.start();
            return true;
        } catch (err) {
            voiceLogger.error('recognition:startFailed', { message: err.message });
            this.onError(`Failed to start: ${err.message}`);
            return false;
        }
    }

    /** Stop gracefully — process whatever was captured */
    stop() {
        if (Date.now() - this._lastToggle < 300) return;
        this._lastToggle = Date.now();
        this.stopped = true;
        if (this.recognition) {
            voiceLogger.info('recognition:stopRequested');
            this.recognition.stop();
            this.recognition = null;
        }
    }

    /** Cancel — discard everything and return to idle */
    cancel() {
        this.cancelled = true;
        this.stopped = true;
        if (this.recognition) {
            voiceLogger.info('recognition:cancelRequested');
            this.recognition.abort();  // abort() doesn't fire onresult, just onend
            this.recognition = null;
        }
    }
}
