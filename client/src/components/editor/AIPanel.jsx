// client/src/components/AIPanel.jsx
import React, { useState } from 'react';
import api from '@/services/api';

export default function AIPanel({ token }) {
  const [text, setText] = useState('');
  const [resp, setResp] = useState(null);

  async function grammarCheck() {
    const { data } = await api.post('/ai/grammar-check', { text });
    setResp(data);
  }

  return <div>
    <h4>AI Assistant</h4>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} />
    <button onClick={grammarCheck}>Check Grammar</button>
    <pre>{JSON.stringify(resp, null, 2)}</pre>
  </div>;
}
