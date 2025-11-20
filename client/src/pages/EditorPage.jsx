// src/pages/EditorPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api, { setAuthToken } from '../services/api';
import { getToken } from '../utils/auth';
import { createSocket } from '../services/socket';

export default function EditorPage() {
  const { id: documentId } = useParams();
  const [value, setValue] = useState('');
  const [connected, setConnected] = useState(false);
  const quillRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (token) setAuthToken(token);

    // fetch doc data for initial content
    async function loadDoc() {
      try {
        const res = await api.get(`/documents/${documentId}`);
        // doc.data might be Quill delta or HTML; try use as HTML string if present
        const data = res.data?.data;
        if (typeof data === 'string') setValue(data);
        else if (data && data.ops) {
          // Quill delta -> convert to HTML by setting contents (we'll set as plain text fallback)
          // Simplest: set stored delta as HTML via deltaToHtml? For now use Quill to set contents on mount via ref.
          // We'll store delta as JSON string inside a hidden prop and apply once Quill exists.
          // For now: keep a JSON string in value to apply later.
          setValue(''); // will be replaced once editor mounted
          // store delta on socket join later
          socketRef.current?.emit && socketRef.current.emit('load-delta', { documentId, delta: data });
        } else setValue('');
      } catch (err) {
        console.error('load doc err', err);
      }
    }
    loadDoc();
    // eslint-disable-next-line
  }, [documentId]);

  useEffect(() => {
    const token = getToken();
    const socket = createSocket(token);
    socketRef.current = socket;

    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-document', { documentId });
    });

    socket.on('document-data', (data) => {
      // server may send HTML or raw string
      if (typeof data === 'string') setValue(data);
      else if (data && data.ops) {
        // if delta sent, apply to editor once ready
        const editor = quillRef.current?.getEditor();
        if (editor) editor.setContents(data);
        else setValue(''); // fallback
      }
    });

    socket.on('remote-text-change', (delta) => {
      // apply delta
      const editor = quillRef.current?.getEditor();
      if (!editor) return;
      try {
        editor.updateContents(delta);
      } catch (err) {
        console.warn('apply delta failed', err);
      }
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [documentId]);

  function handleChange(content, delta, source) {
    setValue(content);
    if (source === 'user' && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('text-change', { documentId, delta });
    }
  }

  // autosave via HTTP every 30s
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        // saving HTML string value (simple). For stronger fidelity store Quill delta instead.
        await api.put(`/documents/${documentId}`, { data: value });
        if (socketRef.current?.connected) socketRef.current.emit('save-document', { documentId, data: value });
      } catch (err) {
        console.warn('autosave failed', err);
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [documentId, value]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        Document: <strong>{documentId}</strong> — Socket: <strong>{connected ? 'connected' : 'disconnected'}</strong>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8 }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={handleChange}
          style={{ minHeight: 400 }}
        />
      </div>
    </div>
  );
}
