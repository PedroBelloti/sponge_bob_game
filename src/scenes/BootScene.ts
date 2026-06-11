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

    // ── Sprites reais ─────────────────────────────────────────────
    // Cada frame é uma imagem separada (recorte exato do personagem) — fatiar
    // o spritesheet por largura fixa vazava pedaços do frame vizinho, porque
    // os personagens tinham espaçamento irregular na folha original.
    // O frame 0 é carregado sob a mesma chave que as cenas usavam para os
    // placeholders — os guards `if (!textures.exists(...))` então pulam a
    // geração do placeholder e o sprite real prevalece.
    this.load.image('plankton-placeholder', 'assets/plankton-walk-0.png');
    this.load.image('plankton-walk-1', 'assets/plankton-walk-1.png');
    this.load.image('plankton-walk-2', 'assets/plankton-walk-2.png');
    this.load.image('plankton-walk-3', 'assets/plankton-walk-3.png');
    this.load.image('bob-placeholder', 'assets/bob-walk-0.png');
    this.load.image('bob-walk-1', 'assets/bob-walk-1.png');
    this.load.image('bob-walk-2', 'assets/bob-walk-2.png');
    this.load.image('roboplankton', 'assets/roboplankton.png');
  }

  create(): void {
    // Frames em imagens separadas: não há mais vizinhos na textura para
    // "vazar" ao amostrar, então o filtro NEAREST deixou de ser necessário.

    // Animação de caminhada do Plankton — anims são globais a todas as cenas
    if (!this.anims.exists('plankton-walk')) {
      this.anims.create({
        key: 'plankton-walk',
        frames: [
          { key: 'plankton-placeholder' },
          { key: 'plankton-walk-1' },
          { key: 'plankton-walk-2' },
          { key: 'plankton-walk-3' },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }

    if (!this.anims.exists('bob-walk')) {
      // Ping-pong 0→1→2→1: só transições entre frames adjacentes = mais fluido
      this.anims.create({
        key: 'bob-walk',
        frames: [
          { key: 'bob-placeholder' },
          { key: 'bob-walk-1' },
          { key: 'bob-walk-2' },
          { key: 'bob-walk-1' },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    this.time.delayedCall(800, () => {
      this.scene.start('PrologoScene');
    });
  }
}
