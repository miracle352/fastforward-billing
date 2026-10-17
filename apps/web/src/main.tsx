import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectedApp } from './App';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
const previewState = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('preview') : null;

if (import.meta.env.DEV && previewState) {
  // Development-only visual states, permanently labelled "Design preview · Not connected".
  // Stripped from production builds; never used as a fallback for the connected app.
  void import('./preview/Preview').then(({ Preview }) =>
    root.render(<StrictMode><Preview state={previewState} /></StrictMode>));
} else {
  root.render(<StrictMode><ConnectedApp /></StrictMode>);
}
