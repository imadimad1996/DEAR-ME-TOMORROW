import './styles.css';
import { GameApp } from './app/GameApp';

const root = document.getElementById('app');
if (!root) {
  throw new Error('App root not found');
}

const app = new GameApp(root);
app.start();
