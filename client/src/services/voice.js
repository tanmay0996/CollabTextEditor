// client/src/services/voice.js
import { voiceLogger } from '@/utils/voiceLogger';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechSupported() {
    return Boolean(SpeechRecognition);
}

export class VoiceRecorder {
    constructor({ onInterim, onFinal, onError, onStatusChange }) {
        this.onInterim = onInterim;
        this.onFinal = onFinal;
        this.onError = onError;
        this.onStatusChange = onStatusChange || (() => { });
        this.recognition = null;
        this.finalTranscript = '';
        this.stopped = false;
    }

    start(lang = 'en-US') {
        if (!SpeechRecognition) {
            this.onError('Speech recognition not supported. Try Chrome or Edge.');
            return false;
        }

        voiceLogger.info('mic:requesting');

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = lang;
        this.finalTranscript = '';
        this.stopped = false;

        this.recognition.onstart = () => {
            voiceLogger.info('recognition:start');
            this.onStatusChange('recording');
        };

        this.recognition.onresult = (event) => {
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
            if (event.error === 'not-allowed') {
                this.onError('Microphone permission denied. Please allow access in browser settings.');
            } else if (event.error === 'no-speech') {
                voiceLogger.debug('recognition:noSpeech');
            } else if (event.error !== 'aborted') {
                this.onError(`Speech recognition error: ${event.error}`);
            }
        };

        this.recognition.onend = () => {
            voiceLogger.info('recognition:end', { finalLen: this.finalTranscript.length, stopped: this.stopped });
            if (this.finalTranscript.trim()) {
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

    stop() {
        this.stopped = true;
        if (this.recognition) {
            voiceLogger.info('recognition:stopRequested');
            this.recognition.stop();
            this.recognition = null;
        }
    }
}
