// src/pages/DocumentsList.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { getToken } from '../utils/auth';
import { FileText, Loader2, Plus, Copy, Check } from 'lucide-react';

export default function DocumentsList() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null); // 👈 only new state
  const nav = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (token) setAuthToken(token);

    let cancelled = false;
    async function load() {
      try {
        const res = await api.get('/documents');
        if (cancelled) return;
        setDocs(res.data || []);
      } catch (err) {
        console.error('Failed to load docs', err);
        if (err?.response?.status === 401) nav('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  async function createDoc(e) {
    e.preventDefault();
    if (!title.trim()) return alert('Enter a title');
    setCreating(true);
    try {
      const res = await api.post('/documents', { title: title.trim() });
      const doc = res.data;
      nav(`/docs/${doc._id}`);
    } catch (err) {
      console.error('create error', err);
      alert(err?.response?.data?.error || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  function handleCopy(docId) {
    navigator.clipboard?.writeText(
      window.location.origin + `/docs/${docId}`
    );
    setCopiedId(docId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="w-12 h-12 bg-gray-100 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="w-20 h-8 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-10 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
              <p className="text-sm text-gray-500">
                All your documents — edit, create, and collaborate in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Create form */}
        <form
          onSubmit={createDoc}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New document title"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
              disabled={creating}
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          </div>
        </form>

        {/* Documents list */}
        {loading ? (
          renderSkeleton()
        ) : docs.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-200 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No documents yet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first document to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {docs.map((d) => (
              <li
                key={d._id}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <Link
                      to={`/docs/${d._id}`}
                      className="text-base font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {d.title || 'Untitled'}
                    </Link>
                    <div className="text-sm text-gray-500 mt-1">
                      Updated:{' '}
                      {new Date(d.updatedAt || d.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/docs/${d._id}`}
                    className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 transition"
                  >
                    Open
                  </Link>

                  {/* ✅ Animated copy button */}
                  <button
                    onClick={() => handleCopy(d._id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-200
                      ${
                        copiedId === d._id
                          ? 'bg-green-50 text-green-700 border-green-200 scale-105'
                          : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                      }`}
                  >
                    {copiedId === d._id ? (
                      <>
                        <Check className="w-4 h-4 animate-pulse" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy link
                      </>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
