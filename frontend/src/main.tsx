import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import './index.css';

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (e) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="color:#f87171;background:#0a0f1e;min-height:100vh;padding:2rem;font-family:monospace;white-space:pre-wrap;font-size:13px;">${e instanceof Error ? e.stack : String(e)}</div>`;
  }
}
