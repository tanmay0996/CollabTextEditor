// client/src/pages/EditorPage.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import api, { setAuthToken } from '../services/api';
import { getToken } from '../utils/auth';
import { createSocket } from '../services/socket';
import AIWritingAssistant from '../../components/AIWritingAssistant';

// Simple toast notification component
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm z-50 animate-fade-in`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm">{message}</p>
        <button onClick={onClose} className="text-white hover:text-gray-200 font-bold">×</button>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { id: documentId } = useParams();
  const [status, setStatus] = useState('loading');
  const [grammarState, setGrammarState] = useState({ status: 'idle', data: null, error: null });
  const [enhancementState, setEnhancementState] = useState({ status: 'idle', data: null, error: null });
  const [summaryState, setSummaryState] = useState({ status: 'idle', data: null, error: null });
  const [completionState, setCompletionState] = useState({ status: 'idle', data: null, error: null });
  const [suggestionsState, setSuggestionsState] = useState({ status: 'idle', data: null, error: null });
  const [selectionText, setSelectionText] = useState('');
  const [toast, setToast] = useState(null);
  
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const selectionRef = useRef('');

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    autofocus: true,
    onUpdate: ({ editor, transaction }) => {
      if (applyingRemoteRef.current) return;

      const now = Date.now();
      if (!editorRef.current) editorRef.current = { lastSent: 0 };
      const lastSent = editorRef.current.lastSent || 0;
      if (now - lastSent < 300) return;
      editorRef.current.lastSent = now;

      try {
        const json = editor.getJSON();
        if (socketRef.current?.connected) {
          socketRef.current.emit('editor-update', { documentId, json });
        }
      } catch (err) {
        console.warn('emit editor-update failed', err);
      }
    },
  });

  const handleApiError = useCallback((err, setStateFunc, fallbackMessage) => {
    console.error('API error:', err);
    
    const errorData = err?.response?.data;
    const userMessage = errorData?.userMessage || errorData?.error || err.message || fallbackMessage;
    
    setStateFunc({ status: 'error', data: null, error: userMessage });
    showToast(userMessage, 'warning');
  }, [showToast]);

  const checkGrammar = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    
    if (!plain.trim()) {
      setGrammarState({ status: 'empty', data: null, error: null });
      showToast('Please write some text to check grammar.', 'info');
      return;
    }

    setGrammarState({ status: 'loading', data: null, error: null });

    try {
      const res = await api.post('/ai/grammar-check', { text: plain });
      setGrammarState({ status: 'ready', data: res.data, error: null });
      
      if (res.data.corrections?.length === 0) {
        showToast('Great! No grammar issues found.', 'info');
      } else {
        showToast(`Found ${res.data.corrections?.length || 0} suggestions for improvement.`, 'info');
      }
    } catch (err) {
      handleApiError(err, setGrammarState, 'Grammar check failed');
    }
  }, [editor, showToast, handleApiError]);

  const enhanceText = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    const selection = selectionRef.current;

    if (!plain.trim()) {
      setEnhancementState({ status: 'empty', data: null, error: null });
      showToast('Please write some text to enhance.', 'info');
      return;
    }

    setEnhancementState({ status: 'loading', data: null, error: null });

    try {
      const res = await api.post('/ai/enhance-text', { text: plain, selection });
      setEnhancementState({ status: 'ready', data: res.data, error: null });
      showToast('Text enhancement ready! Click "Apply" to use it.', 'info');
    } catch (err) {
      handleApiError(err, setEnhancementState, 'Enhancement failed');
    }
  }, [editor, showToast, handleApiError]);

  const generateSummary = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    
    if (!plain.trim()) {
      setSummaryState({ status: 'empty', data: null, error: null });
      showToast('Please write some content to summarize.', 'info');
      return;
    }

    setSummaryState({ status: 'loading', data: null, error: null });

    try {
      const res = await api.post('/ai/summarize', { text: plain });
      setSummaryState({ status: 'ready', data: res.data, error: null });
      showToast('Summary generated successfully!', 'info');
    } catch (err) {
      handleApiError(err, setSummaryState, 'Summary generation failed');
    }
  }, [editor, showToast, handleApiError]);

  const getSuggestions = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    
    if (!plain.trim()) {
      setSuggestionsState({ status: 'empty', data: null, error: null });
      showToast('Please write some content to get suggestions.', 'info');
      return;
    }

    setSuggestionsState({ status: 'loading', data: null, error: null });

    try {
      const res = await api.post('/ai/get-suggestions', { text: plain });
      setSuggestionsState({ status: 'ready', data: res.data, error: null });
      showToast(`Generated ${res.data.ideas?.length || 0} writing suggestions!`, 'info');
    } catch (err) {
      handleApiError(err, setSuggestionsState, 'Suggestions failed');
    }
  }, [editor, showToast, handleApiError]);

  const getCompletion = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    
    if (!plain.trim()) {
      setCompletionState({ status: 'empty', data: null, error: null });
      showToast('Start typing to get auto-completion suggestions.', 'info');
      return;
    }

    setCompletionState({ status: 'loading', data: null, error: null });

    try {
      const cursor = editor.state?.selection?.from ?? plain.length;
      console.log('[Auto-complete] Requesting with cursor:', cursor, 'text length:', plain.length);
      
      const res = await api.post('/ai/auto-complete', { text: plain, cursor });
      console.log('[Auto-complete] Response:', res.data);
      
      setCompletionState({ status: 'ready', data: res.data, error: null });
      
      if (res.data.completion) {
        showToast('Completion ready! Click "Insert" to add it.', 'info');
      }
    } catch (err) {
      handleApiError(err, setCompletionState, 'Completion failed');
    }
  }, [editor, showToast, handleApiError]);

  const applyEnhancedText = useCallback((text) => {
    if (!editor || !text) return;
    const { from, to } = editor.state.selection;
    const chain = editor.chain().focus();
    
    if (from !== to) {
      chain.deleteSelection();
    }
    
    chain.insertContent(text).run();
    showToast('Enhancement applied successfully!', 'info');
    
    // Clear the enhancement state after applying
    setEnhancementState({ status: 'idle', data: null, error: null });
  }, [editor, showToast]);

  // Add this new function after the applyEnhancedText function
const applyGrammarFixes = useCallback(() => {
  if (!editor || !grammarState.data?.correctedText) return;
  
  // Replace entire document content with corrected text
  applyingRemoteRef.current = true;
  editor.chain().focus().clearContent().insertContent(grammarState.data.correctedText).run();
  applyingRemoteRef.current = false;
  
  showToast('Grammar fixes applied successfully!', 'info');
  
  // Clear grammar state after applying
  setGrammarState({ status: 'idle', data: null, error: null });
}, [editor, grammarState.data, showToast]);

// Then pass it to the AIWritingAssistant component

  const insertCompletion = useCallback((text) => {
    if (!editor || !text) return;
    editor.chain().focus().insertContent(text).run();
    showToast('Completion inserted!', 'info');
    
    // Clear the completion state after inserting
    setCompletionState({ status: 'idle', data: null, error: null });
  }, [editor, showToast]);

  useEffect(() => {
    let cancelled = false;
    async function loadDoc() {
      setStatus('loading');
      try {
        const token = getToken();
        if (token) setAuthToken(token);

        const res = await api.get(`/documents/${documentId}`);
        if (cancelled) return;
        const serverData = res.data?.data;

        if (!editor) {
          setStatus('ready');
          return;
        }

        applyingRemoteRef.current = true;
        if (!serverData) {
          editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
        } else if (typeof serverData === 'string') {
          editor.commands.setContent(serverData);
        } else {
          editor.commands.setContent(serverData);
        }
        applyingRemoteRef.current = false;
        setStatus('ready');
      } catch (err) {
        console.error('Load document failed', err);
        if (!cancelled) {
          setStatus('error');
          showToast('Failed to load document', 'error');
        }
      }
    }
    loadDoc();
    return () => { cancelled = true; };
  }, [documentId, editor, showToast]);

  useEffect(() => {
    const token = getToken();
    const socket = createSocket(token);
    socketRef.current = socket;

    socket.connect();

    socket.on('connect', () => {
      socket.emit('join-document', { documentId });
    });

    socket.on('document-data', (payload) => {
      if (!editor) return;
      try {
        applyingRemoteRef.current = true;
        if (!payload) {
          editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
        } else if (payload.json) {
          editor.commands.setContent(payload.json);
        } else if (typeof payload === 'string') {
          editor.commands.setContent(payload);
        } else {
          editor.commands.setContent(payload);
        }
      } catch (err) {
        console.warn('apply document-data failed', err);
      } finally {
        applyingRemoteRef.current = false;
        setStatus('ready');
      }
    });

    socket.on('remote-editor-update', ({ json, from }) => {
      if (!editor) return;
      try {
        if (!json) return;
        applyingRemoteRef.current = true;
        editor.commands.setContent(json);
      } catch (err) {
        console.warn('apply remote update failed', err);
      } finally {
        setTimeout(() => { applyingRemoteRef.current = false; }, 30);
      }
    });

    socket.on('document-saved', (meta) => {
      console.log('document-saved', meta);
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected');
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [documentId, editor]);

  useEffect(() => {
    const iv = setInterval(async () => {
      if (!editor) return;
      try {
        const json = editor.getJSON();
        await api.put(`/documents/${documentId}`, { data: json });
        if (socketRef.current?.connected) {
          socketRef.current.emit('save-document', { documentId, data: json });
        }
      } catch (err) {
        console.warn('Autosave failed', err);
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [documentId, editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const handleSelection = () => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        selectionRef.current = '';
        setSelectionText('');
        return;
      }
      const text = editor.state.doc.textBetween(from, to, ' ');
      const trimmed = text.trim();
      selectionRef.current = trimmed;
      setSelectionText(trimmed);
    };
    editor.on('selectionUpdate', handleSelection);
    handleSelection();
    return () => {
      editor.off('selectionUpdate', handleSelection);
    };
  }, [editor]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">Document:</span> {documentId}
            </p>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">Status:</span> {status}
            </p>
          </div>

          <div className="border border-gray-200 rounded-2xl bg-white shadow-sm min-h-[400px] p-2">
            {editor ? (
              <EditorContent editor={editor} className="min-h-[360px] prose max-w-none p-4" />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">Loading editor…</div>
            )}
          </div>
        </div>

        <AIWritingAssistant
          grammarState={grammarState}
          enhancementState={enhancementState}
          summaryState={summaryState}
          completionState={completionState}
          suggestionsState={suggestionsState}
          onCheckGrammar={checkGrammar}
          onEnhanceText={enhanceText}
          onGenerateSummary={generateSummary}
          onGetSuggestions={getSuggestions}
          onGetCompletion={getCompletion}
          onApplyEnhancement={applyEnhancedText}
          onApplyGrammarFixes={applyGrammarFixes} 
          onInsertCompletion={insertCompletion}
          selectionText={selectionText}
        />
      </div>
    </div>
  );
}