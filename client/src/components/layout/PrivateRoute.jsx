// client/src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

export default function PrivateRoute({ children }) {
  const location = useLocation();
  const { status } = useAuth();

  if (status === 'unknown') {
    return null;
  }

  if (status !== 'authenticated') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ returnTo }} />;
  }

  return children;
}
