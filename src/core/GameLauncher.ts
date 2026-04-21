import * as Phaser from 'phaser';
import { phaserConfig } from '../config/phaser.config';

export function launchGame(): void {
  const menu = document.getElementById('menu-container');
  const game = document.getElementById('game-container');

  // Overlay preto que cobre o estado em branco enquanto Phaser inicializa
  const fade = document.createElement('div');
  fade.style.cssText =
    'position:fixed;inset:0;z-index:10002;background:#000;opacity:1;transition:opacity 600ms ease;pointer-events:none;';
  document.body.appendChild(fade);

  if (menu) menu.style.display = 'none';
  if (game) game.style.display = 'block';
  new Phaser.Game(phaserConfig);

  // Dois rAF garantem que o browser pintou antes de iniciar o fade-out
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fade.style.opacity = '0';
    });
  });

  setTimeout(() => fade.remove(), 650);
}
