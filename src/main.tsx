import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeLocaleProvider } from './lib/i18n';
import { ToastProvider } from './lib/toast';
import { AuthProvider } from './contexts/AuthContext';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';

// Prevent harmless Vite HMR WebSocket disconnect messages from triggering overlay errors
// and auto-recover once from stale chunk-load failures after fresh deployments
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('magoodhoo_chunk_reload');
  } catch {}

  const isChunkLoadFailure = (msg: string) =>
    /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      msg
    );

  const recoverOnceFromStaleChunk = () => {
    try {
      const reloaded = sessionStorage.getItem('magoodhoo_chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('magoodhoo_chunk_reload', '1');
        window.location.reload();
      }
    } catch {}
  };

  window.addEventListener('vite:preloadError', (event) => {
    event?.preventDefault?.();
    recoverOnceFromStaleChunk();
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || String(event?.error?.message || '');
    if (msg.includes('WebSocket') || msg.includes('websocket')) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      return true;
    }
    if (isChunkLoadFailure(msg)) {
      recoverOnceFromStaleChunk();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    if (msg.includes('WebSocket') || msg.includes('websocket')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (isChunkLoadFailure(msg)) {
      event.preventDefault();
      recoverOnceFromStaleChunk();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SectionErrorBoundary
      areaNameEn="Magoodhoo School Library Portal"
      areaNameDv="މަގޫދޫ ސްކޫލް ލައިބްރަރީ ޕޯޓަލް"
    >
      <ThemeLocaleProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeLocaleProvider>
    </SectionErrorBoundary>
  </StrictMode>
);
