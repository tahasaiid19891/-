import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign ResizeObserver loop errors that trigger dev server/Vite error overlays
if (typeof window !== 'undefined') {
  const suppressResizeObserverError = (message: string) => {
    return (
      message.includes('ResizeObserver loop completed with undelivered notifications') ||
      message.includes('ResizeObserver loop limit exceeded')
    );
  };

  const originalError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = message ? message.toString() : '';
    if (suppressResizeObserverError(msgStr)) {
      return true; // Prevents the error from propagating to the browser / error overlay
    }
    if (originalError) {
      return originalError.apply(this, arguments as any);
    }
    return false;
  };

  window.addEventListener('error', (event) => {
    if (event.message && suppressResizeObserverError(event.message)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = event.reason && event.reason.message ? event.reason.message.toString() : '';
    if (suppressResizeObserverError(reasonStr)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

