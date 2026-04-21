import * as Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Carregando...', {
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  create(): void {
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }
}
