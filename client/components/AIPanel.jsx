// client/src/components/AIPanel.jsx
import React, { useState } from 'react';
import axios from 'axios';

export default function AIPanel({ token }) {
  const [text, setText] = useState('');
  const [resp, setResp] = useState(null);

  async function grammarCheck() {
    const { data } = await axios.post(`${process.env.REACT_APP_SERVER_URL}/api/ai/grammar-check`, { text }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setResp(data);
  }

  return <div>
    <h4>AI Assistant</h4>
    <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} />
    <button onClick={grammarCheck}>Check Grammar</button>
    <pre>{JSON.stringify(resp, null, 2)}</pre>
  </div>;
}
