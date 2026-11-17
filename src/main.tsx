import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeLocaleProvider } from './lib/i18n';
import { ToastProvider } from './lib/toast';
import { ErrorBoundary } from './components/ErrorBoundary';

// Prevent harmless Vite HMR WebSocket disconnect messages from triggering overlay errors
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('magoodhoo_chunk_reload');
  } catch {}

  window.addEventListener('error', (event) => {
    const msg = event?.message || String(event?.error?.message || '');
    if (msg.includes('WebSocket') || msg.includes('websocket')) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      return true;
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    if (
      reason &&
      (reason.message?.includes('WebSocket') ||
        reason.message?.includes('websocket') ||
        String(reason).includes('WebSocket') ||
        String(reason).includes('websocket'))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary areaNameEn="Magoodhoo School Library Portal" areaNameDv="މަގޫދޫ ސްކޫލް ލައިބްރަރީ ޕޯޓަލް">
      <ThemeLocaleProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeLocaleProvider>
    </ErrorBoundary>
  </StrictMode>,
);

