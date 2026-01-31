import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Toaster, toast } from 'react-hot-toast';
import { 
  Menu, X, Save, Eye, EyeOff, ChevronDown, User, LogOut, 
  FileText, Sparkles, PanelRightClose, PanelRight
} from 'lucide-react';
import api from '@/services/api';
import { connectSocket } from '@/services/socket';
import AIWritingAssistant from '@/components/editor/AIWritingAssistant';
import { useAuth } from '@/auth/AuthProvider';

export default function EditorPage() {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [status, setStatus] = useState('loading');
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [wordCount, setWordCount] = useState(0);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [focusMode, _setFocusMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // AI States
  const [grammarState, setGrammarState] = useState({ status: 'idle', data: null, error: null });
  const [enhancementState, setEnhancementState] = useState({ status: 'idle', data: null, error: null });
  const [summaryState, setSummaryState] = useState({ status: 'idle', data: null, error: null });
  const [completionState, setCompletionState] = useState({ status: 'idle', data: null, error: null });
  const [suggestionsState, setSuggestionsState] = useState({ status: 'idle', data: null, error: null });
  const [selectionText, setSelectionText] = useState('');
  
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const selectionRef = useRef('');
  const versionRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedJsonRef = useRef(null);
  const pendingRemoteRef = useRef(null);

  const emitDocEdit = useCallback((json) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    if (inFlightRef.current) {
      queuedJsonRef.current = json;
      return;
    }

    inFlightRef.current = true;
    socket.emit('doc:edit', { documentId, json, baseVersion: versionRef.current });
  }, [documentId]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    autofocus: true,
    onUpdate: ({ editor }) => {
      if (applyingRemoteRef.current) return;
      // Update word count
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      // Throttled emit
      const now = Date.now();
      if (!editorRef.current) editorRef.current = { lastSent: 0 };
      if (now - editorRef.current.lastSent < 300) return;
      editorRef.current.lastSent = now;
      try {
        const json = editor.getJSON();
        emitDocEdit(json);
      } catch (err) {
        console.warn('emit editor-update failed', err);
      }
    },
  });

  const handleApiError = useCallback((err, setStateFunc, fallbackMessage) => {
    const errorData = err?.response?.data;
    const userMessage = errorData?.userMessage || errorData?.error || err.message || fallbackMessage;
    setStateFunc({ status: 'error', data: null, error: userMessage });
    toast.error(userMessage);
  }, []);

  // Manual save
  const saveDocument = useCallback(async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      const json = editor.getJSON();
      const res = await api.put(`/documents/${documentId}`, { data: json, title: docTitle, baseVersion: versionRef.current });
      versionRef.current = typeof res.data?.version === 'number' ? res.data.version : versionRef.current;
      setLastSaved(new Date());
      toast.success('Document saved');
    } catch (err) {
      console.warn('Failed to save document', err);
      if (err?.response?.status === 409 && err?.response?.data?.doc) {
        const serverDoc = err.response.data.doc;
        versionRef.current = typeof serverDoc?.version === 'number' ? serverDoc.version : versionRef.current;
        if (serverDoc?.title) setDocTitle(serverDoc.title);
        if (serverDoc?.data) {
          applyingRemoteRef.current = true;
          try { editor.commands.setContent(serverDoc.data); } catch { void 0; }
          applyingRemoteRef.current = false;
        }
        toast.error('Your save was stale. Synced to latest.');
      } else {
        const msg = err?.response?.data?.error || err?.message || 'Failed to save document';
        toast.error(msg);
      }
    } finally {
      setIsSaving(false);
    }
  }, [editor, documentId, docTitle]);

  // AI Functions
  const checkGrammar = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    if (!plain.trim()) {
      toast('Please write some text first', { icon: 'ℹ️' });
      return;
    }
    setGrammarState({ status: 'loading', data: null, error: null });
    toast.loading('Checking grammar...', { id: 'grammar' });
    try {
      const res = await api.post('/ai/grammar-check', { text: plain });
      setGrammarState({ status: 'ready', data: res.data, error: null });
      toast.success(`Found ${res.data.corrections?.length || 0} suggestions`, { id: 'grammar' });
    } catch (err) {
      handleApiError(err, setGrammarState, 'Grammar check failed');
      toast.error('Grammar check failed', { id: 'grammar' });
    }
  }, [editor, handleApiError]);

  const enhanceText = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    const selection = selectionRef.current;
    if (!plain.trim()) {
      toast('Please write some text first', { icon: 'ℹ️' });
      return;
    }
    setEnhancementState({ status: 'loading', data: null, error: null });
    toast.loading('Enhancing text...', { id: 'enhance' });
    try {
      const res = await api.post('/ai/enhance-text', { text: plain, selection });
      setEnhancementState({ status: 'ready', data: res.data, error: null });
      toast.success('Enhancement ready!', { id: 'enhance' });
    } catch (err) {
      handleApiError(err, setEnhancementState, 'Enhancement failed');
      toast.error('Enhancement failed', { id: 'enhance' });
    }
  }, [editor, handleApiError]);

  const generateSummary = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    if (!plain.trim()) {
      toast('Please write some content first', { icon: 'ℹ️' });
      return;
    }
    setSummaryState({ status: 'loading', data: null, error: null });
    toast.loading('Generating summary...', { id: 'summary' });
    try {
      const res = await api.post('/ai/summarize', { text: plain });
      setSummaryState({ status: 'ready', data: res.data, error: null });
      toast.success('Summary generated!', { id: 'summary' });
    } catch (err) {
      handleApiError(err, setSummaryState, 'Summary failed');
      toast.error('Summary failed', { id: 'summary' });
    }
  }, [editor, handleApiError]);

  const getSuggestions = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    if (!plain.trim()) {
      toast('Please write some content first', { icon: 'ℹ️' });
      return;
    }
    setSuggestionsState({ status: 'loading', data: null, error: null });
    toast.loading('Getting suggestions...', { id: 'suggestions' });
    try {
      const res = await api.post('/ai/get-suggestions', { text: plain });
      setSuggestionsState({ status: 'ready', data: res.data, error: null });
      toast.success(`${res.data.ideas?.length || 0} suggestions ready!`, { id: 'suggestions' });
    } catch (err) {
      handleApiError(err, setSuggestionsState, 'Suggestions failed');
      toast.error('Suggestions failed', { id: 'suggestions' });
    }
  }, [editor, handleApiError]);

  const getCompletion = useCallback(async () => {
    if (!editor) return;
    const plain = editor.getText();
    if (!plain.trim()) {
      toast('Start typing to get completions', { icon: 'ℹ️' });
      return;
    }
    setCompletionState({ status: 'loading', data: null, error: null });
    toast.loading('Generating completion...', { id: 'complete' });
    try {
      const cursor = editor.state?.selection?.from ?? plain.length;
      const res = await api.post('/ai/auto-complete', { text: plain, cursor });
      setCompletionState({ status: 'ready', data: res.data, error: null });
      if (res.data.completion) toast.success('Completion ready!', { id: 'complete' });
    } catch (err) {
      handleApiError(err, setCompletionState, 'Completion failed');
      toast.error('Completion failed', { id: 'complete' });
    }
  }, [editor, handleApiError]);

  // Apply functions
  const applyEnhancedText = useCallback((text) => {
    if (!editor || !text) return;
    const { from, to } = editor.state.selection;
    const chain = editor.chain().focus();
    if (from !== to) chain.deleteSelection();
    chain.insertContent(text).run();
    toast.success('Enhancement applied!');
    setEnhancementState({ status: 'idle', data: null, error: null });
  }, [editor]);

  const applyGrammarFix = useCallback((correction, index) => {
    if (!editor || !correction) return;
    // Apply single correction - find and replace
    const content = editor.getHTML();
    if (correction.original && correction.corrected) {
      const newContent = content.replace(correction.original, correction.corrected);
      applyingRemoteRef.current = true;
      editor.commands.setContent(newContent);
      applyingRemoteRef.current = false;

      try {
        emitDocEdit(editor.getJSON());
      } catch {
        void 0;
      }
    }
    // Remove that correction from grammarState so panel updates immediately
    if (grammarState.data?.corrections) {
      const newCorrections = grammarState.data.corrections.filter((_, i) => i !== index);
      // Update correctedText if available: regenerate by applying remaining corrections naive approach
      const newData = { ...grammarState.data, corrections: newCorrections };
      // If no corrections left, clear state
      if (newCorrections.length === 0) {
        setGrammarState({ status: 'idle', data: null, error: null });
      } else {
        setGrammarState({ status: 'ready', data: newData, error: null });
      }
    } else {
      setGrammarState({ status: 'idle', data: null, error: null });
    }
    toast.success('Fix applied!');
  }, [editor, grammarState.data, emitDocEdit]);

  const applyAllGrammarFixes = useCallback(() => {
    if (!editor || !grammarState.data?.correctedText) return;
    applyingRemoteRef.current = true;
    editor.chain().focus().clearContent().insertContent(grammarState.data.correctedText).run();
    applyingRemoteRef.current = false;

    try {
      emitDocEdit(editor.getJSON());
    } catch {
      void 0;
    }
    toast.success('All fixes applied!');
    setGrammarState({ status: 'idle', data: null, error: null });
  }, [editor, grammarState.data, emitDocEdit]);

  const insertCompletion = useCallback((text) => {
    if (!editor || !text) return;
    editor.chain().focus().insertContent(text).run();
    toast.success('Completion inserted!');
    setCompletionState({ status: 'idle', data: null, error: null });
  }, [editor]);

  const declineCompletion = useCallback(() => {
    setCompletionState({ status: 'idle', data: null, error: null });
    toast('Completion dismissed', { icon: 'ℹ️' });
  }, []);

  const declineEnhancement = useCallback(() => {
    setEnhancementState({ status: 'idle', data: null, error: null });
    toast('Enhancement dismissed', { icon: 'ℹ️' });
  }, []);

  const declineSummary = useCallback(() => {
    setSummaryState({ status: 'idle', data: null, error: null });
    toast('Summary dismissed', { icon: 'ℹ️' });
  }, []);

  const copySummary = useCallback(() => {
    if (summaryState.data?.summary) {
      navigator.clipboard.writeText(summaryState.data.summary);
      toast.success('Summary copied!');
    }
  }, [summaryState.data]);

  const insertSummary = useCallback(() => {
    if (!editor || !summaryState.data?.summary) return;
    editor.chain().focus().insertContent(`\n\n---\n**Summary:**\n${summaryState.data.summary}\n---\n`).run();
    toast.success('Summary inserted!');
    setSummaryState({ status: 'idle', data: null, error: null });
  }, [editor, summaryState.data]);

  // Suggestions accept/decline handlers
  const applySuggestion = useCallback((idea, index) => {
    if (!editor || !idea) return;
    // Default action: insert suggestion detail at cursor
    editor.chain().focus().insertContent(idea.detail).run();
    // remove suggestion from state list
    if (suggestionsState.data?.ideas) {
      const newIdeas = suggestionsState.data.ideas.filter((_, i) => i !== index);
      if (newIdeas.length === 0) {
        setSuggestionsState({ status: 'idle', data: null, error: null });
      } else {
        setSuggestionsState({ status: 'ready', data: { ...suggestionsState.data, ideas: newIdeas }, error: null });
      }
    }
    toast.success('Suggestion applied!');
  }, [editor, suggestionsState.data]);

  const dismissSuggestion = useCallback((index) => {
    if (!suggestionsState.data?.ideas) return;
    const newIdeas = suggestionsState.data.ideas.filter((_, i) => i !== index);
    if (newIdeas.length === 0) {
      setSuggestionsState({ status: 'idle', data: null, error: null });
    } else {
      setSuggestionsState({ status: 'ready', data: { ...suggestionsState.data, ideas: newIdeas }, error: null });
    }
    toast('Suggestion dismissed', { icon: 'ℹ️' });
  }, [suggestionsState.data]);

  // Dismiss grammar correction (called when user declines a single correction)
  const dismissGrammarCorrection = useCallback((index) => {
    if (!grammarState.data?.corrections) return;
    const newCorrections = grammarState.data.corrections.filter((_, i) => i !== index);
    if (newCorrections.length === 0) {
      setGrammarState({ status: 'idle', data: null, error: null });
    } else {
      setGrammarState({ status: 'ready', data: { ...grammarState.data, corrections: newCorrections }, error: null });
    }
    toast('Correction dismissed', { icon: 'ℹ️' });
  }, [grammarState.data]);

  // Load document
  useEffect(() => {
    let cancelled = false;
    async function loadDoc() {
      setStatus('loading');
      try {
        const res = await api.get(`/documents/${documentId}`);
        if (cancelled) return;
        const serverData = res.data?.data;
        versionRef.current = typeof res.data?.version === 'number' ? res.data.version : 0;
        if (res.data?.title) setDocTitle(res.data.title);
        if (!editor) { setStatus('ready'); return; }
        applyingRemoteRef.current = true;
        if (!serverData) {
          editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
        } else {
          editor.commands.setContent(serverData);
        }
        applyingRemoteRef.current = false;
        setWordCount(editor.getText().trim().split(/\s+/).filter(Boolean).length);
        setStatus('ready');
      } catch (err) {
        console.warn('Failed to load document', err);
        const msg = err?.response?.data?.error || err?.message || 'Failed to load document';
        if (!cancelled) { setStatus('error'); toast.error(msg); }
      }
    }
    loadDoc();
    return () => { cancelled = true; };
  }, [documentId, editor]);

  // Socket setup
  useEffect(() => {
    let mounted = true;
    let socket;

    (async () => {
      try {
        socket = await connectSocket();
        if (!mounted) return;
        socketRef.current = socket;
        socket.on('connect', async () => {
          socket.emit('join-document', { documentId });
          try {
            const res = await api.get(`/documents/${documentId}`);
            const incomingVersion = typeof res.data?.version === 'number' ? res.data.version : 0;
            if (incomingVersion > versionRef.current && editor) {
              versionRef.current = incomingVersion;
              applyingRemoteRef.current = true;
              editor.commands.setContent(res.data?.data || { type: 'doc', content: [{ type: 'paragraph' }] });
              applyingRemoteRef.current = false;
            }
          } catch {
            void 0;
          }
        });

        socket.on('connect_error', (e) => {
          console.warn('socket connect_error', e?.message || e);
        });

        socket.on('document-title', (title) => {
          if (typeof title === 'string' && title.trim()) setDocTitle(title);
        });

        socket.on('doc:init', (payload) => {
          if (!editor || !payload) return;
          const incomingVersion = typeof payload.version === 'number' ? payload.version : 0;
          versionRef.current = incomingVersion;
          if (typeof payload.title === 'string' && payload.title.trim()) setDocTitle(payload.title);
          applyingRemoteRef.current = true;
          try {
            editor.commands.setContent(payload.data || { type: 'doc', content: [{ type: 'paragraph' }] });
          } catch {
            void 0;
          }
          applyingRemoteRef.current = false;
          setStatus('ready');
        });

        socket.on('doc:update', (payload) => {
          if (!editor || !payload) return;
          const incomingVersion = typeof payload.version === 'number' ? payload.version : 0;
          if (incomingVersion <= versionRef.current) return;

          if (inFlightRef.current) {
            const pendingVersion = typeof pendingRemoteRef.current?.version === 'number' ? pendingRemoteRef.current.version : 0;
            if (!pendingVersion || incomingVersion > pendingVersion) {
              pendingRemoteRef.current = payload;
            }
            return;
          }

          versionRef.current = incomingVersion;
          inFlightRef.current = false;
          queuedJsonRef.current = null;
          if (typeof payload.title === 'string' && payload.title.trim()) setDocTitle(payload.title);

          applyingRemoteRef.current = true;
          try {
            editor.commands.setContent(payload.data);
          } catch {
            void 0;
          }
          applyingRemoteRef.current = false;
        });

        socket.on('doc:ack', (payload) => {
          const newVersion = typeof payload?.version === 'number' ? payload.version : null;
          if (typeof newVersion === 'number') versionRef.current = newVersion;
          inFlightRef.current = false;
          setLastSaved(new Date());

          const pending = pendingRemoteRef.current;
          pendingRemoteRef.current = null;
          if (pending) {
            const pendingVersion = typeof pending.version === 'number' ? pending.version : 0;
            if (pendingVersion > versionRef.current && editor) {
              versionRef.current = pendingVersion;
              if (typeof pending.title === 'string' && pending.title.trim()) setDocTitle(pending.title);
              applyingRemoteRef.current = true;
              try { editor.commands.setContent(pending.data); } catch { void 0; }
              applyingRemoteRef.current = false;
            }
          }

          const queued = queuedJsonRef.current;
          queuedJsonRef.current = null;
          if (queued && socketRef.current?.connected) {
            inFlightRef.current = true;
            socketRef.current.emit('doc:edit', { documentId, json: queued, baseVersion: versionRef.current });
          }
        });

        socket.on('doc:reject', ({ reason, current }) => {
          console.warn('doc:reject', reason);
          inFlightRef.current = false;
          queuedJsonRef.current = null;
          pendingRemoteRef.current = null;
          const incomingVersion = typeof current?.version === 'number' ? current.version : 0;
          versionRef.current = incomingVersion;
          if (current?.title) setDocTitle(current.title);
          if (editor && current?.data) {
            applyingRemoteRef.current = true;
            try { editor.commands.setContent(current.data); } catch { void 0; }
            applyingRemoteRef.current = false;
          }
          toast.error('Document was updated elsewhere. Synced to latest.');
        });

        socket.on('document-data', (payload) => {
          if (!editor) return;
          const incomingVersion = typeof payload?.version === 'number' ? payload.version : 0;
          if (incomingVersion && incomingVersion <= versionRef.current) return;
          if (incomingVersion) versionRef.current = incomingVersion;

          applyingRemoteRef.current = true;
          try {
            if (payload?.json) editor.commands.setContent(payload.json);
            else if (payload) editor.commands.setContent(payload);
          } catch {
            void 0;
          }
          applyingRemoteRef.current = false;
          setStatus('ready');
        });

        socket.on('remote-editor-update', ({ json, version }) => {
          if (!editor || !json) return;
          const incomingVersion = typeof version === 'number' ? version : 0;
          if (incomingVersion && incomingVersion <= versionRef.current) return;
          if (incomingVersion) versionRef.current = incomingVersion;

          applyingRemoteRef.current = true;
          editor.commands.setContent(json);
          setTimeout(() => { applyingRemoteRef.current = false; }, 30);
        });
      } catch (err) {
        console.warn('Failed to connect socket', err);
      }
    })();

    return () => {
      mounted = false;
      try { socket?.disconnect(); } catch { void 0; }
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [documentId, editor]);

  // Auto-save
  useEffect(() => {
    return () => void 0;
  }, [documentId, editor, docTitle]);

  // Selection tracking
  useEffect(() => {
    if (!editor) return;
    const handleSelection = () => {
      const { from, to } = editor.state.selection;
      const text = from !== to ? editor.state.doc.textBetween(from, to, ' ').trim() : '';
      selectionRef.current = text;
      setSelectionText(text);
    };
    editor.on('selectionUpdate', handleSelection);
    return () => editor.off('selectionUpdate', handleSelection);
  }, [editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDocument]);

  const handleLogout = () => {
    try {
      // Disconnect realtime socket if active
      try {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      } catch (e) {
        console.warn('Socket disconnect error', e);
      }

      try {
        logout();
      } catch {
        void 0;
      }

      navigate('/login');
      toast.success('Logged out');
    } catch (e) {
      console.warn('Socket disconnect error', e);
      try { navigate('/login'); } catch { void 0; }
      toast.success('Logged out');
    }
  };
  

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col ${focusMode ? 'bg-gray-900' : ''}`}>
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: '8px', padding: '12px 16px' } }} />
      
      {/* Header */} 
      <header className={`sticky top-0 z-40 border-b ${focusMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Logo & Title */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/docs')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Back to documents">
              <FileText className={`w-5 h-5 ${focusMode ? 'text-gray-300' : 'text-blue-600'}`} />
            </button>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className={`font-semibold text-lg border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 max-w-[200px] md:max-w-[300px] ${focusMode ? 'text-white' : 'text-gray-900'}`}
              placeholder="Document title"
            />
          </div>
          
          {/* Center: Status */}
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
            <span>{wordCount} words</span>
            {lastSaved && (
              <span className="flex items-center gap-1">
                <Save className="w-3.5 h-3.5" />
                {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {isSaving && <span className="text-blue-600 animate-pulse">Saving...</span>}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* <button onClick={() => setFocusMode(!focusMode)} className={`p-2 rounded-lg transition-colors ${focusMode ? 'bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title={focusMode ? 'Exit focus mode' : 'Focus mode (Ctrl+Shift+F)'}>
              {focusMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button> */}
            <button onClick={saveDocument} disabled={isSaving} className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm font-medium" title="Save (Ctrl+S)">
              <Save className="w-4 h-4" />
              Save
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg transition-colors hidden lg:block ${focusMode ? 'bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title={sidebarOpen ? 'Hide AI panel' : 'Show AI panel'}>
              {sidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRight className="w-5 h-5" />}
            </button>
            {/* User Menu */}
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className={`p-2 rounded-lg transition-colors ${focusMode ? 'bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <User className="w-5 h-5" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
            {/* Mobile menu */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <main className={`flex-1 overflow-auto p-4 md:p-6 lg:p-8 transition-all ${focusMode ? 'bg-gray-900' : ''}`}>
          <div className={`max-w-4xl mx-auto ${focusMode ? 'max-w-3xl' : ''}`}>
            <div className={`rounded-xl shadow-sm min-h-[calc(100vh-200px)] ${focusMode ? 'bg-gray-800 border-gray-700' : 'bg-white border border-gray-200'}`}>
              {status === 'loading' ? (
                <div className="p-8 space-y-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : editor ? (
                <EditorContent editor={editor} className={`prose max-w-none p-6 md:p-8 min-h-[400px] focus:outline-none ${focusMode ? 'prose-invert' : ''}`} />
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">Loading editor...</div>
              )}
            </div>
          </div>
        </main>

        {/* AI Sidebar - Desktop */}
        {sidebarOpen && !focusMode && (
          <aside className="hidden lg:block w-[400px] border-l border-gray-200 bg-white overflow-y-auto">
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
              onApplyGrammarFix={applyGrammarFix}            // (correction, index)
              onApplyAllGrammarFixes={applyAllGrammarFixes}
              onInsertCompletion={insertCompletion}
              onCopySummary={copySummary}
              onInsertSummary={insertSummary}
              onRegenerateSummary={generateSummary}
              onRegenerateEnhancement={enhanceText}
              // NEW dismissal/apply handlers
              onDismissGrammar={dismissGrammarCorrection}
              onDeclineEnhancement={declineEnhancement}
              onDeclineCompletion={declineCompletion}
              onDeclineSummary={declineSummary}
              onDismissSuggestion={dismissSuggestion}
              onApplySuggestion={applySuggestion}
              selectionText={selectionText}
            />
          </aside>
        )}
      </div>

      {/* Mobile Bottom Sheet for AI */}
      {mobileMenuOpen && !focusMode && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">AI Assistant</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
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
              onApplyGrammarFix={applyGrammarFix}
              onApplyAllGrammarFixes={applyAllGrammarFixes}
              onInsertCompletion={insertCompletion}
              onCopySummary={copySummary}
              onInsertSummary={insertSummary}
              onRegenerateSummary={generateSummary}
              onRegenerateEnhancement={enhanceText}
              onDismissGrammar={dismissGrammarCorrection}
              onDeclineEnhancement={declineEnhancement}
              onDeclineCompletion={declineCompletion}
              onDeclineSummary={declineSummary}
              onDismissSuggestion={dismissSuggestion}
              onApplySuggestion={applySuggestion}
              selectionText={selectionText}
            />
          </div>
        </div>
      )}

      {/* Floating AI Button - Mobile */}
      {!focusMode && (
        <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-105 z-30">
          <Sparkles className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
