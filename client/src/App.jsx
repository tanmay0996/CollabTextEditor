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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome — First time setup</h2>
        <p className="text-gray-600 mb-6">There are no users yet. Create the admin account to get started.</p>
        <Link 
          to="/register" 
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Create first account
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Welcome to Collab Editor</h2>
        <div className="space-y-4">
          <div className="space-x-4">
            <Link 
              to="/login" 
              className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Login
            </Link>
            <span className="text-gray-500">or</span>
            <Link 
              to="/register" 
              className="inline-flex justify-center py-2 px-6 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Register
            </Link>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <Link 
              to="/docs" 
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Go to Documents (requires login)
            </Link>
          </div>
        </div>
      </div>
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

  // while we don't know firstTime, show a loading spinner
  if (firstTime === null) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );

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
      <Route 
        path="*" 
        element={
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-lg text-gray-600 mb-6">Page not found</p>
              <Link 
                to="/" 
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Go back home →
              </Link>
            </div>
          </div>
        } 
      />
    </Routes>
  );
}
