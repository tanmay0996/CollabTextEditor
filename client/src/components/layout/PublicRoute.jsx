import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

export default function PublicRoute({ children }) {
  const { status } = useAuth();

  if (status === 'unknown') {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (status === 'authenticated') {
    return <Navigate to="/docs" replace />;
  }

  return children;
}
