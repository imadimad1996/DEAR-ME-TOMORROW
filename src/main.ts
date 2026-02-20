import './styles.css';
import { Game } from './engine/Game';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app root');
}

new Game(root);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Ignore in dev if unsupported.
    });
  });
}
