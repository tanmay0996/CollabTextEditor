import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

export default function PublicRoute({ children }) {
  const { status } = useAuth();

  if (status === 'unknown') {
    return null;
  }

  if (status === 'authenticated') {
    return <Navigate to="/docs" replace />;
  }

  return children;
}
