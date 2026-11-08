// Must run before any module that parses with Zod (strict CSP, ADR-004).
import './lib/zodConfig';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import '../styles.css';

const container = document.querySelector('#root');

if (!container) {
  console.error('[Main] Failed to find the root element');
  throw new Error('Failed to find the root element');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
