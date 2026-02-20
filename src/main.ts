import './styles.css';
import { GameApp } from './app/GameApp';

const root = document.getElementById('app');
if (!root) {
  throw new Error('App root not found');
}

try {
  const app = new GameApp(root);
  app.start();
} catch (error) {
  console.error('[boot] Failed to start game', error);
  root.innerHTML = `
    <div class="fatal-screen">
      <div class="fatal-card">
        <h2>Unable to load game</h2>
        <p>Saved data may be incompatible with this build.</p>
        <button id="reset-save-btn" type="button">Reset Save & Reload</button>
      </div>
    </div>
  `;

  const reset = root.querySelector<HTMLButtonElement>('#reset-save-btn');
  reset?.addEventListener('click', () => {
    localStorage.removeItem('merge_manor_letters_save_v2');
    localStorage.removeItem('merge_manor_letters_save_v1');
    window.location.reload();
  });
}
