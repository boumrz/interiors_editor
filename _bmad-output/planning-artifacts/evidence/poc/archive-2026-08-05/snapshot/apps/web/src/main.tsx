import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PocApp } from './poc/PocApp';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <PocApp />
  </StrictMode>
);
