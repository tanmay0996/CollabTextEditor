import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './index.css';

import { AuthProvider } from '@/auth/AuthProvider';
import { setNavigate } from '@/services/navigation';

function NavigationBridge({ children }) {
  const navigate = useNavigate();

  React.useEffect(() => {
    setNavigate(navigate);
    return () => setNavigate(null);
  }, [navigate]);

  return children;
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in index.html');

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <NavigationBridge>
        <AuthProvider>
          <App />
        </AuthProvider>
      </NavigationBridge>
    </BrowserRouter>
  </React.StrictMode>
);
