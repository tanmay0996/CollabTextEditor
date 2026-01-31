// src/pages/DocumentsList.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import {
  FileText,
  Loader2,
  Plus,
  Copy,
  Check,
  ArrowUpRight,
} from 'lucide-react';

export default function DocumentsList() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get('/documents');
        if (!cancelled) setDocs(res.data || []);
      } catch (err) {
        void 0;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function createDoc(e) {
    e.preventDefault();
    if (!title.trim()) return alert('Enter a title');
    setCreating(true);
    try {
      const res = await api.post('/documents', { title: title.trim() });
      nav(`/docs/${res.data._id}`);
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

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-10 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              My Documents
            </h1>
            <p className="text-sm text-gray-500">
              Edit, create, and collaborate in real time.
            </p>
          </div>
        </div>

        {/* Create form */}
        <form
          onSubmit={createDoc}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New document title"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
              disabled={creating}
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Create</span>
            </button>
          </div>
        </form>

        {/* Documents list */}
        {loading ? (
          <div className="text-center text-gray-400">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-200 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No documents yet
            </h3>
            <p className="text-sm text-gray-500">
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
                {/* Left */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <Link
                      to={`/docs/${d._id}`}
                      className="text-base font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {d.title || 'Untitled'}
                    </Link>
                    <div className="text-xs text-gray-500 mt-1">
                      Updated {new Date(d.updatedAt || d.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Right: compact horizontal icon buttons */}
                <div className="flex items-center gap-2">
                  {/* Open */}
                  <Link
                    to={`/docs/${d._id}`}
                    title="Open document"
                    className="inline-flex items-center justify-center
                               h-9 w-9 sm:w-auto
                               sm:px-3 sm:py-2
                               bg-blue-50 text-blue-700
                               rounded-lg border border-blue-100
                               hover:bg-blue-100 transition"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2 text-sm">Open</span>
                  </Link>

                  {/* Copy */}
                  <button
                    onClick={() => handleCopy(d._id)}
                    title={copiedId === d._id ? 'Copied!' : 'Copy link'}
                    className={`inline-flex items-center justify-center
                      h-9 w-9 sm:w-auto
                      sm:px-3 sm:py-2
                      rounded-lg border transition-all
                      ${
                        copiedId === d._id
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                      }`}
                  >
                    {copiedId === d._id ? (
                      <Check className="w-4 h-4 animate-pulse" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline ml-2 text-sm">
                      {copiedId === d._id ? 'Copied' : 'Copy'}
                    </span>
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
