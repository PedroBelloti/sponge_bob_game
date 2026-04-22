import * as Phaser from 'phaser';

export class Phase2Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Phase2Scene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#0a1628');

    this.add
      .text(width / 2, height / 2 - 30, 'FASE 2 — LULA MOLUSCO', {
        fontSize: '32px', color: '#FFD700', fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 30, 'Em desenvolvimento...', {
        fontSize: '18px', color: '#ffffff',
      })
      .setOrigin(0.5);

    this.input.keyboard!.on('keydown-ESC', () => {
      console.log('[Phase2Scene] ESC pressionado');
    });
  }
}
