import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/gentium-plus/400.css';
import '@fontsource/gentium-plus/400-italic.css';
import '@fontsource/gentium-plus/700.css';
import './index.css';
import { App } from './app/App';
import { applyCachedAppearance } from './lib/appearance';

applyCachedAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support (spec §5.2). Production only: a service worker in dev would
// serve stale modules over hot reload.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional; the app works without it.
    });
  });
}
