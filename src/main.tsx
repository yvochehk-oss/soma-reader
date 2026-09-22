import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root mount point.');

// The static HTML shipped from index.html contains a server-rendered
// fallback for crawlers and no-JS visitors. Clear it before handing the
// container to React so the SPA renders cleanly without hydration
// warnings, while the static copy is still present in the initial document
// the moment the page loads.
rootElement.replaceChildren();
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
