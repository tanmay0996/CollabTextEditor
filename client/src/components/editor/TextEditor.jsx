// client/src/components/EditorPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import Quill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { connectSocket } from '@/services/socket';
import api from '@/services/api';

export default function EditorPage({ documentId }) {
  const [quill, setQuill] = useState(null);
  const socketRef = useRef(null);
  const versionRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let s;

    (async () => {
      try {
        s = await connectSocket();
        if (!mounted) return;
        socketRef.current = s;
        s.on('connect', () => console.log('socket connected in client', s.id));
        s.on('document-data', (data) => {
          const json = data?.json || data;
          if (typeof data?.version === 'number') versionRef.current = data.version;
          if (quill) quill.setContents(json);
        });

        s.on('remote-text-change', (delta) => {
          if (quill) quill.updateContents(delta);
        });

        s.on('doc:update', (payload) => {
          if (!payload) return;
          const incomingVersion = typeof payload.version === 'number' ? payload.version : 0;
          if (incomingVersion && incomingVersion <= versionRef.current) return;
          if (incomingVersion) versionRef.current = incomingVersion;
          if (quill && payload.data) quill.setContents(payload.data);
        });

        s.on('doc:ack', (payload) => {
          const incomingVersion = typeof payload?.version === 'number' ? payload.version : 0;
          if (incomingVersion) versionRef.current = incomingVersion;
        });
      } catch (err) {
        console.warn('socket connect failed', err);
      }
    })();
    return () => {
      mounted = false;
      try { s?.disconnect(); } catch { /* ignore */ }
    };
  }, [quill]);

  useEffect(() => {
    if (!quill || !socketRef.current) return;
    // join room
    socketRef.current.emit('join-document', { documentId, user: { id: 'anon', name: 'You' } });

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      socketRef.current.emit('text-change', { documentId, delta });
    };
    quill.on('text-change', handler);

    // autosave local -> send save event every 30s
    const interval = setInterval(() => {
      const data = quill.getContents();
      socketRef.current.emit('save-document', { documentId, data, baseVersion: versionRef.current });
      // also persist via HTTP for reliability
      api.put(`/documents/${documentId}`, { data, baseVersion: versionRef.current }).catch(() => { /* ignore */ });
    }, 30000);

    return () => { quill.off('text-change', handler); clearInterval(interval); };

  }, [quill, documentId]);

  return <div>
    <Quill theme="snow" ref={(el) => setQuill(el && el.getEditor())} />
  </div>;
}
