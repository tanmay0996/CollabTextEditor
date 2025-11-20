// client/src/components/EditorPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import Quill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { connectSocket } from '../services/socket';
import axios from 'axios';

export default function EditorPage({ documentId, token }) {
  const [quill, setQuill] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = connectSocket(process.env.REACT_APP_SERVER_URL || 'http://localhost:8000');
    socketRef.current = s;
    s.auth = { token }; // optional
    s.connect();

    s.on('connect', () => console.log('socket connected in client', s.id));
    s.on('document-data', (data) => {
      if (quill) quill.setContents(data);
    });

    s.on('remote-text-change', delta => {
      if (quill) quill.updateContents(delta);
    });

    return () => {
      s.disconnect();
    };
  }, [quill, token]);

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
      socketRef.current.emit('save-document', { documentId, data });
      // also persist via HTTP for reliability
      axios.put(`${process.env.REACT_APP_SERVER_URL}/api/documents/${documentId}`, { data }, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(()=>{/* ignore */});
    }, 30000);

    return () => { quill.off('text-change', handler); clearInterval(interval); };

  }, [quill, documentId, token]);

  return <div>
    <Quill theme="snow" ref={(el) => setQuill(el && el.getEditor())} />
  </div>;
}
