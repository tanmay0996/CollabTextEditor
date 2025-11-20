// client/src/pages/EditorPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import api, { setAuthToken } from '../services/api';
import { getToken } from '../utils/auth';
import { createSocket } from '../services/socket';

export default function EditorPage() {
  const { id: documentId } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const editorRef = useRef(null);
  const socketRef = useRef(null);
  const applyingRemoteRef = useRef(false);

  // create editor (empty initial content, we'll set content after loading)
  const editor = useEditor({
    extensions: [StarterKit],
    content: '', // will set later from server
    autofocus: true,
    onUpdate: ({ editor, transaction }) => {
      // Skip broadcasting when applying remote changes
      if (applyingRemoteRef.current) return;

      // throttle/limit frequency of emits: simple time-based throttle
      const now = Date.now();
      if (!editorRef.current) editorRef.current = { lastSent: 0 };
      const lastSent = editorRef.current.lastSent || 0;
      // send at most once per 300ms
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

  // Load initial document content (HTTP)
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

        // server may store html string OR JSON doc
        if (!editor) {
          // editor not ready yet; we'll handle when editor becomes ready
          setStatus('ready');
          return;
        }

        applyingRemoteRef.current = true;
        if (!serverData) {
          editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
        } else if (typeof serverData === 'string') {
          // if stored as HTML string, set as text/HTML
          editor.commands.setContent(serverData);
        } else {
          // assume Tiptap/Prosemirror JSON
          editor.commands.setContent(serverData);
        }
        applyingRemoteRef.current = false;
        setStatus('ready');
      } catch (err) {
        console.error('Load document failed', err);
        if (!cancelled) setStatus('error');
      }
    }
    loadDoc();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [documentId, editor]);

  // Socket setup (join room, receive remote updates)
  useEffect(() => {
    const token = getToken();
    const socket = createSocket(token);
    socketRef.current = socket;

    // connect and join
    socket.connect();

    socket.on('connect', () => {
      // join this document room
      socket.emit('join-document', { documentId });
    });

    // initial document data from socket (if server chooses to send)
    socket.on('document-data', (payload) => {
      // payload expected: { json } or raw json or html string
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
          // assume json doc
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
      // apply remote update if it's not from self
      if (!editor) return;
      try {
        // avoid applying if update is empty
        if (!json) return;
        applyingRemoteRef.current = true;
        editor.commands.setContent(json);
      } catch (err) {
        console.warn('apply remote update failed', err);
      } finally {
        // small timeout to ensure onUpdate from setContent is ignored
        setTimeout(() => { applyingRemoteRef.current = false; }, 30);
      }
    });

    socket.on('document-saved', (meta) => {
      // optional UI hook: show saved indicator briefly
      console.log('document-saved', meta);
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected');
    });

    return () => {
      if (socket) socket.disconnect();
    };
    // eslint-disable-next-line
  }, [documentId, editor]);

  // Autosave via HTTP every 30s
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

  // cleanup
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Document:</strong> {documentId} — <strong>Status:</strong> {status}
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, minHeight: 300 }}>
        {editor ? <EditorContent editor={editor} /> : <div>Loading editor…</div>}
      </div>
    </div>
  );
}
