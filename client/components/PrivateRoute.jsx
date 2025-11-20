// client/src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../src/utils/auth';
// import { getToken } from '../utils/auth';

export default function PrivateRoute({ children }) {
  const token = getToken();
  if (!token) {
    // not authenticated -> go to login
    return <Navigate to="/login" replace />;
  }
  return children;
}
