// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FileText, Users, Sparkles, Shield, ArrowRight, Loader2 } from 'lucide-react';
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Collab Editor</h2>
          <p className="text-gray-600 mb-8">No users found. Create the first admin account to get started.</p>
          <Link 
            to="/register" 
            className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
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
      <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-blue-600">
          <FileText className="w-7 h-7" />
          <span className="font-bold text-xl">Collab Editor</span>
        </div>
        <div className="flex items-center gap-3">
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
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Write better, together with{' '}
            <span className="text-blue-600">AI-powered</span> collaboration
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed">
            The modern document editor that combines real-time collaboration with intelligent writing assistance. 
            Check grammar, enhance your text, and get smart suggestions instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/register" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 text-lg"
            >
              Start writing for free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/login" 
              className="w-full sm:w-auto px-8 py-4 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-all text-lg"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div 
                key={idx}
                className="bg-white rounded-2xl p-6 shadow-lg shadow-gray-900/5 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Demo Preview */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-t from-blue-50 via-transparent to-transparent pointer-events-none z-10" />
          <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/10 border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 text-sm text-gray-500">Untitled Document</span>
            </div>
            <div className="p-8 min-h-[300px] bg-white">
              <div className="flex gap-6">
                <div className="flex-1 space-y-4">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-5/6" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                </div>
                <div className="w-72 bg-gray-50 rounded-xl p-4 space-y-3">
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
        <p>© 2024 Collab Editor. Built with ❤️ for better writing.</p>
      </footer>
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
        <div className="text-center">
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