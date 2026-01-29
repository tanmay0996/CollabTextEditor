import React from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '@/utils/auth';

export default function PublicRoute({ children }) {
  const token = getToken();
  if (token) {
    // already signed in -> go to documents
    return <Navigate to="/docs" replace />;
  }
  return children;
}
