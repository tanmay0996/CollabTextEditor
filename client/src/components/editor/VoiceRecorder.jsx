// client/src/components/editor/VoiceRecorder.jsx
import React, { useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { VoiceRecorder as VoiceService, isSpeechSupported } from '@/services/voice';
import { useVoiceStore } from '@/stores/voiceStore';
import { voiceLogger } from '@/utils/voiceLogger';
import toast from 'react-hot-toast';

export default function VoiceRecorder({ onInterim, onFinal, disabled }) {
  const status = useVoiceStore((s) => s.status);
  const startRecording = useVoiceStore((s) => s.startRecording);
  const stopRecording = useVoiceStore((s) => s.stopRecording);
  const recorderRef = useRef(null);

  const handleError = useCallback((msg) => {
    voiceLogger.warn('component:error', { message: msg });
    toast.error(msg);
  }, []);

  const handleStatusChange = useCallback((s) => {
    voiceLogger.debug('component:statusChange', { to: s });
    if (s === 'recording') {
      startRecording();
    } else if (s === 'idle') {
      // Only reset to idle if still in 'recording' state.
      // If status is 'cleaning', handleVoiceFinal already took over.
      const current = useVoiceStore.getState().status;
      if (current === 'recording') {
        stopRecording();
        voiceLogger.debug('component:autoStopped');
      }
    }
  }, [startRecording, stopRecording]);

  const toggle = useCallback(() => {
    if (status === 'recording') {
      voiceLogger.info('component:stopRequested');
      recorderRef.current?.stop();
      recorderRef.current = null;
      return;
    }

    if (!isSpeechSupported()) {
      toast.error('Speech recognition not supported in this browser. Try Chrome or Edge.');
      return;
    }

    voiceLogger.info('component:startRequested');
    const recorder = new VoiceService({
      onInterim,
      onFinal,
      onError: handleError,
      onStatusChange: handleStatusChange,
    });

    recorderRef.current = recorder;
    const ok = recorder.start();
    if (!ok) recorderRef.current = null;
  }, [status, onInterim, onFinal, handleError, handleStatusChange]);

  const isActive = status === 'recording';
  const isCleaning = status === 'cleaning';

  return (
    <button
      onClick={toggle}
      disabled={disabled || isCleaning}
      title={
        isActive
          ? 'Stop recording'
          : isCleaning
            ? 'Cleaning up transcript…'
            : 'Voice to text'
      }
      className={`relative p-2 rounded-lg transition-all ${
        isActive
          ? 'bg-red-100 text-red-600 hover:bg-red-200 ring-2 ring-red-400 ring-offset-1'
          : isCleaning
            ? 'bg-amber-50 text-amber-600 cursor-wait'
            : 'hover:bg-gray-100 text-gray-600'
      }`}
    >
      {isCleaning ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isActive ? (
        <>
          <MicOff className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        </>
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
}
