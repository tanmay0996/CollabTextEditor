// client/src/components/editor/VoiceRecorder.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Loader2, Check, AlertCircle, Keyboard } from 'lucide-react';
import { VoiceRecorder as VoiceService, isSpeechSupported, SUPPORTED_BROWSERS } from '@/services/voice';
import { useVoiceStore } from '@/stores/voiceStore';
import { voiceLogger } from '@/utils/voiceLogger';
import toast from 'react-hot-toast';

// --- Waveform sub-component ---
function Waveform() {
  return (
    <div className="flex items-end gap-[3px] h-4" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="voice-bar text-red-500" />
      ))}
    </div>
  );
}

// --- Elapsed time formatter ---
function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VoiceRecorder({ onInterim, onFinal, onCancel, disabled }) {
  const status = useVoiceStore((s) => s.status);
  const elapsedMs = useVoiceStore((s) => s.elapsedMs);
  const interimText = useVoiceStore((s) => s.interimText);
  const startRecording = useVoiceStore((s) => s.startRecording);
  const stopRecording = useVoiceStore((s) => s.stopRecording);
  const setError = useVoiceStore((s) => s.setError);
  const setInterimText = useVoiceStore((s) => s.setInterimText);

  const recorderRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const tooltipTimeout = useRef(null);

  // --- Show/hide the expanded panel based on status ---
  useEffect(() => {
    if (status === 'recording' || status === 'cleaning') {
      setPanelVisible(true);
    } else if (status === 'success') {
      // keep visible briefly for the success state
      const t = setTimeout(() => setPanelVisible(false), 1800);
      return () => clearTimeout(t);
    } else {
      // idle or error — close after animation
      const t = setTimeout(() => setPanelVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [status]);

  // --- Callbacks ---
  const handleInterim = useCallback((text) => {
    setInterimText(text);
    onInterim(text);
  }, [onInterim, setInterimText]);

  const handleError = useCallback((msg) => {
    voiceLogger.warn('component:error', { message: msg });
    setError(msg);
    toast.error(msg, { duration: 5000, icon: '🎤' });
  }, [setError]);

  const handleStatusChange = useCallback((s) => {
    voiceLogger.debug('component:statusChange', { to: s });
    if (s === 'recording') {
      startRecording();
    } else if (s === 'idle') {
      // Only reset if we're still in 'recording' (not 'cleaning')
      const current = useVoiceStore.getState().status;
      if (current === 'recording') {
        stopRecording();
        voiceLogger.debug('component:autoStopped');
      }
    }
  }, [startRecording, stopRecording]);

  const handleCancelInternal = useCallback(() => {
    voiceLogger.info('component:cancelled');
    stopRecording();
    onCancel?.();
  }, [stopRecording, onCancel]);

  // --- Start / Stop / Cancel ---
  const startVoice = useCallback(() => {
    if (!isSpeechSupported()) {
      toast.error(`Speech recognition not supported. Use ${SUPPORTED_BROWSERS}.`, {
        duration: 6000,
        icon: '⚠️',
      });
      return;
    }

    voiceLogger.info('component:startRequested');
    const recorder = new VoiceService({
      onInterim: handleInterim,
      onFinal,
      onCancel: handleCancelInternal,
      onError: handleError,
      onStatusChange: handleStatusChange,
    });

    recorderRef.current = recorder;
    const ok = recorder.start();
    if (!ok) recorderRef.current = null;
  }, [handleInterim, onFinal, handleCancelInternal, handleError, handleStatusChange]);

  const stopVoice = useCallback(() => {
    voiceLogger.info('component:stopRequested');
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const cancelVoice = useCallback(() => {
    voiceLogger.info('component:cancelRequested');
    recorderRef.current?.cancel();
    recorderRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (status === 'recording') {
      stopVoice();
    } else if (status === 'idle') {
      startVoice();
    }
    // ignore clicks during cleaning/success/error
  }, [status, startVoice, stopVoice]);

  // --- Keyboard shortcut: Ctrl+Shift+V ---
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  // --- Tooltip hover ---
  const showTip = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 600);
  };
  const hideTip = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  // --- Derived state ---
  const isActive = status === 'recording';
  const isCleaning = status === 'cleaning';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isBusy = isCleaning || isSuccess;

  // --- Button classes ---
  const buttonClass = [
    'relative p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
    isActive && 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400 voice-ring-pulse',
    isCleaning && 'bg-blue-50 text-blue-600 cursor-wait focus:ring-blue-300',
    isSuccess && 'bg-emerald-50 text-emerald-600 focus:ring-emerald-300',
    isError && 'bg-red-50 text-red-500 focus:ring-red-300',
    !isActive && !isBusy && !isError && 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-300',
    (disabled || isBusy) && 'opacity-60 cursor-not-allowed',
  ].filter(Boolean).join(' ');

  return (
    <div className="relative" onMouseEnter={showTip} onMouseLeave={hideTip}>
      {/* --- Main mic button --- */}
      <button
        id="voice-recorder-btn"
        onClick={toggle}
        disabled={disabled || isBusy}
        aria-label={
          isActive ? 'Stop voice dictation'
            : isCleaning ? 'Cleaning up transcript'
            : isSuccess ? 'Transcript cleaned successfully'
            : 'Start voice dictation'
        }
        aria-pressed={isActive}
        className={buttonClass}
      >
        {isCleaning ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isSuccess ? (
          <Check className="w-5 h-5" />
        ) : isError ? (
          <AlertCircle className="w-5 h-5" />
        ) : isActive ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* --- Tooltip on hover (idle state only) --- */}
      {showTooltip && status === 'idle' && !disabled && (
        <div className="voice-tooltip absolute top-full mt-2 right-0 z-50 whitespace-nowrap">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
            <p className="font-medium">Click to start speaking</p>
            <p className="text-gray-400 mt-0.5 flex items-center gap-1">
              <Keyboard className="w-3 h-3" />
              Ctrl+Shift+V
            </p>
          </div>
        </div>
      )}

      {/* --- Expanded status panel (recording / cleaning / success) --- */}
      {panelVisible && (
        <div
          className={`absolute top-full mt-2 right-0 z-50 ${
            status === 'idle' || status === 'error' ? 'voice-panel-exit' : 'voice-panel-enter'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-w-[240px]">

            {/* --- Recording state --- */}
            {isActive && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="voice-record-dot" />
                    <span className="text-sm font-medium text-red-600">Listening…</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono tabular-nums">
                      {formatElapsed(elapsedMs)}
                    </span>
                    <button
                      onClick={cancelVoice}
                      className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Cancel dictation"
                      title="Cancel and discard"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Waveform visualizer */}
                <div className="flex items-center gap-3 mb-2">
                  <Waveform />
                  <span className="text-xs text-gray-400">Speak now…</span>
                </div>

                {/* Interim preview */}
                {interimText && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 truncate max-w-[220px]" title={interimText}>
                      {interimText.length > 80 ? `…${interimText.slice(-80)}` : interimText}
                    </p>
                  </div>
                )}

                {/* Stop hint */}
                <p className="text-[10px] text-gray-350 mt-2 text-center">
                  Click <span className="font-medium">Stop</span> or press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Shift+V</kbd>
                </p>
              </div>
            )}

            {/* --- Cleaning state --- */}
            {isCleaning && (
              <div className="p-3 voice-shimmer">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-sm font-medium text-blue-700">Cleaning up…</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Removing filler words and fixing punctuation</p>
              </div>
            )}

            {/* --- Success state --- */}
            {isSuccess && (
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span className="text-sm font-medium text-emerald-700">Text cleaned & inserted</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
