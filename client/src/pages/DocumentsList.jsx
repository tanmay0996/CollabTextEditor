// src/pages/DocumentsList.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { getToken } from '../utils/auth';

export default function DocumentsList() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (token) setAuthToken(token);

    async function load() {
      try {
        const res = await api.get('/documents');
        setDocs(res.data || []);
      } catch (err) {
        console.error('Failed to load docs', err);
        // if unauthorized go to login
        if (err?.response?.status === 401) nav('/login');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line
  }, []);

  async function createDoc(e) {
    e.preventDefault();
    if (!title.trim()) return alert('Enter a title');
    setCreating(true);
    try {
      const res = await api.post('/documents', { title: title.trim() });
      const doc = res.data;
      // go to editor page
      nav(`/docs/${doc._id}`);
    } catch (err) {
      console.error('create error', err);
      alert(err?.response?.data?.error || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div>Loading documents…</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h2>My Documents</h2>

      <form onSubmit={createDoc} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New document title"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
        />
        <button type="submit" disabled={creating} style={{ padding: '8px 12px', borderRadius: 6 }}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      <div>
        {docs.length === 0 && <div>No documents yet. Create one above.</div>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {docs.map((d) => (
            <li key={d._id} style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 8 }}>
              <Link to={`/docs/${d._id}`} style={{ fontSize: 16, fontWeight: 600 }}>{d.title || 'Untitled'}</Link>
              <div style={{ color: '#666', marginTop: 6 }}>
                Updated: {new Date(d.updatedAt || d.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
