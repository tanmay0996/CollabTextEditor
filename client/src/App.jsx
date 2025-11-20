import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import DocumentsList from './pages/DocumentsList';
import EditorPage from './pages/EditorPage';
import PrivateRoute from '../components/PrivateRoute';
import PublicRoute from '../components/PublicRoute';

import api from './services/api';
import { getToken, saveToken } from './utils/auth';

function Landing({ firstTime }) {
  // If first time, show a one-click redirect to register
  if (firstTime) return (
    <div style={{ padding: 20 }}>
      <h2>Welcome — First time setup</h2>
      <p>There are no users yet. Create the admin account to get started.</p>
      <Link to="/register"><button>Create first account</button></Link>
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome to Collab Editor</h2>
      <p><Link to="/login">Login</Link> or <Link to="/register">Register</Link> to continue</p>
      <p><Link to="/docs">Go to Documents (requires login)</Link></p>
    </div>
  );
}

export default function App() {
  const [firstTime, setFirstTime] = useState(null); // null = unknown, true/false known
  const nav = useNavigate();

  useEffect(() => {
    // Check first-time flag (optional). Server should return { firstTime: true/false }
    // If you don't want this, skip calling and default to false.
    let cancelled = false;
    async function checkFirstTime() {
      try {
        const res = await api.get('/auth/first-time');
        if (!cancelled) setFirstTime(res.data?.firstTime === true);
      } catch (err) {
        // If endpoint missing or error, treat as not-first-time
        setFirstTime(false);
      }
    }
    checkFirstTime();
    return () => { cancelled = true; };
  }, []);

  // while we don't know firstTime, show a tiny loader
  if (firstTime === null) return <div style={{ padding: 20 }}>Loading…</div>;

  return (
    <Routes>
      <Route path="/" element={<Landing firstTime={firstTime} />} />

      {/* Public-only routes: if user already logged in, redirect to /docs */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/docs" element={<PrivateRoute><DocumentsList /></PrivateRoute>} />
      <Route path="/docs/:id" element={<PrivateRoute><EditorPage /></PrivateRoute>} />

      {/* fallback */}
      <Route path="*" element={<div style={{ padding: 20 }}>404 — <Link to="/">Home</Link></div>} />
    </Routes>
  );
}
