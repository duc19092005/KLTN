import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import App from './routes/AppRoutes';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from './providers/ToastProvider';
import { StepUpSessionProvider, ScreenLockProvider } from './features/auth';
import { PreferencesProvider } from './providers/PreferencesProvider';
import './index.css';

axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <StepUpSessionProvider>
              <ScreenLockProvider>
                <App />
              </ScreenLockProvider>
            </StepUpSessionProvider>
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
