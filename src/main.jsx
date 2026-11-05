import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LiveProvider } from './context/LiveContext.jsx';
import { ConfirmProvider } from './components/Confirm.jsx';
import './index.css';
import { startResponsiveTables } from './lib/responsiveTables';

startResponsiveTables();

// Toasts sit top-centre on phones (thumb-friendly, never under the notch corners), top-right on larger screens.
const toastPosition = window.matchMedia('(max-width: 639px)').matches ? 'top-center' : 'top-right';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LiveProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </LiveProvider>
        <Toaster position={toastPosition} toastOptions={{ style: { fontSize: 14, maxWidth: 'calc(100vw - 2rem)' } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
