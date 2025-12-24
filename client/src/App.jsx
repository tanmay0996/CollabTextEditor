// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FileText, Users, Sparkles, Shield, ArrowRight, Loader2, Menu, X } from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import DocumentsList from './pages/DocumentsList';
import EditorPage from './pages/EditorPage';
import PrivateRoute from '../components/PrivateRoute';
import PublicRoute from '../components/PublicRoute';
import api from './services/api';

function Landing({ firstTime }) {
  const features = [
    { icon: Users, title: 'Real-time Collaboration', desc: 'Work together with your team in real-time. See changes as they happen.' },
    { icon: Sparkles, title: 'AI Writing Assistant', desc: 'Grammar check, text enhancement, smart completions, and more.' },
    { icon: Shield, title: 'Secure & Private', desc: 'Your documents are encrypted and securely stored.' },
  ];

  if (firstTime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Collab Editor</h2>
          <p className="text-gray-600 mb-6">No users found. Create the first admin account to get started.</p>
          <Link
            to="/register"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            aria-label="Create first admin account"
          >
            Create first account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="px-4 md:px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-blue-600">
          <FileText className="w-7 h-7" />
          <span className="font-bold text-xl">Coolab</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 text-gray-700 font-medium hover:text-blue-600 transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <MobileMenu />
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-12 px-2">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6 leading-tight">
            Write better, together with{' '}
            <span className="text-blue-600">AI-powered</span> collaboration
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-8 leading-relaxed">
            The modern document editor that combines real-time collaboration with intelligent writing assistance.
            Check grammar, enhance your text, and get smart suggestions instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 text-lg"
            >
              Start writing for free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-all text-lg"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg shadow-gray-900/5 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm sm:text-base">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Demo Preview */}
        <div className="relative px-2">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-50 via-transparent to-transparent pointer-events-none z-10" />
          <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/10 border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 text-sm text-gray-500">Untitled Document</span>
            </div>
            <div className="p-6 md:p-8 min-h-[220px] md:min-h-[300px] bg-white">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-5/6" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                </div>
                <div className="w-full md:w-72 bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="h-3 bg-blue-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm">
        <p>© 2025 Collab Editor. Built with ❤️ for better writing.</p>
      </footer>
    </div>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
      </button>

      {open && (
        <div className="absolute right-4 top-12 w-[calc(100vw-32px)] max-w-xs bg-white rounded-xl shadow-lg p-4 border border-gray-100 z-50">
          <nav className="flex flex-col gap-2">
            <Link
              to="/login"
              className="block px-3 py-2 rounded-md text-gray-700 font-medium hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="block px-3 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 text-center"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [firstTime, setFirstTime] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function checkFirstTime() {
      try {
        const res = await api.get('/auth/first-time');
        if (!cancelled) setFirstTime(res.data?.firstTime === true);
      } catch (err) {
        setFirstTime(false);
      }
    }
    checkFirstTime();
    return () => { cancelled = true; };
  }, []);

  if (firstTime === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center px-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: '10px' } }} />
      <Routes>
        <Route path="/" element={<Landing firstTime={firstTime} />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/docs" element={<PrivateRoute><DocumentsList /></PrivateRoute>} />
        <Route path="/docs/:id" element={<PrivateRoute><EditorPage /></PrivateRoute>} />
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center p-6">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-xl text-gray-600 mb-8">Page not found</p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all"
                >
                  Go back home
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          }
        />
      </Routes>
    </>
  );
}
