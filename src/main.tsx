import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/gentium-plus/400.css';
import '@fontsource/gentium-plus/400-italic.css';
import '@fontsource/gentium-plus/700.css';
import './index.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
