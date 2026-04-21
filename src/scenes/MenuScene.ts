import * as Phaser from 'phaser';
import { mountMenuOverlay, unmountMenuOverlay } from '../ui/MenuOverlay';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    mountMenuOverlay(() => {
      console.log('Iniciando jogo...');
      // this.scene.start('Phase1Scene'); // será ativado na próxima fase
    });
  }

  shutdown(): void {
    unmountMenuOverlay();
  }
}
