import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { Patrick } from '../../entities/bosses/Patrick';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_PATRICK } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';

export class Phase1Scene extends BossPhaseScene {
  private patrick!: Patrick;

  // Tufos de algodão (obstáculo da arena — GDD)
  private cottonPool: Phaser.GameObjects.Container[] = [];
  private cottonActive: Set<Phaser.GameObjects.Container> = new Set();
  private cottonTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'Phase1Scene' });
  }

  // ── BossPhaseScene impl ───────────────────────────────────────

  protected buildArena(width: number, height: number): void {
    this.buildTextures();

    this.add.rectangle(width / 2, height / 2, width, height, 0x1c0a00);

    const light = this.add.rectangle(width / 2, height / 2, 200, height, 0xffd700).setAlpha(0.06);
    this.tweens.add({ targets: light, alpha: 0.08, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(16, 16, 'DEBAIXO DA PEDRA', { fontSize: '14px', color: '#8D6E63' });

    this.ground = this.physics.add.staticGroup();
    (this.ground.create(width / 2, height - 25, 'phase1-ground') as Phaser.Physics.Arcade.Sprite).refreshBody();

    this.platforms = this.physics.add.staticGroup();
    const defs: [number, number, string][] = [
      [200, 500, 'phase1-platform-sm'],
      [640, 380, 'phase1-platform'],
      [1050, 460, 'phase1-platform-sm'],
    ];
    defs.forEach(([x, y, key]) => {
      (this.platforms.create(x, y, key) as Phaser.Physics.Arcade.Sprite).refreshBody();
    });
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    // Patrick center: feet at height-50, body height=120 → center at height-110
    this.patrick = new Patrick(this, 1000, height - 110);
    return this.patrick;
  }

  protected getDialog(): DialogConfig {
    return DIALOG_PATRICK;
  }

  protected getNextSceneKey(): string {
    return 'Phase2Scene';
  }

  protected getBossProjectileTextureKey(): string {
    return 'patrick-stone';
  }

  protected getBossBarColor(): number {
    return 0xff8a65;
  }

  // GDD: A = desorientado (lento e imprevisível), B = animado (rápido e legível)
  protected applyMood(optionKey: 'A' | 'B'): void {
    this.patrick.setMood(optionKey === 'A' ? 'desorientado' : 'animado');
  }

  protected onArenaCreate(): void {
    this.cottonPool = [];
    this.cottonActive = new Set();
    this.cottonTimer = null;
    this.setupCottonPool();
    this.scheduleCottonSpawn();
  }

  protected onArenaUpdate(_time: number): void {
    this.checkCottonOverlap();
  }

  protected onBossFinalPhaseHook(): void {
    // GDD: tufos de algodão dobram a frequência na fase final
    this.scheduleCottonSpawn(CONSTANTS.COTTON_SPAWN_INTERVAL / 2);

    const { width, height } = this.scale;
    const msg = this.add
      .text(width / 2, height / 2, 'Patrick ficou irritado!', { fontSize: '24px', color: '#FF8A65' })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
  }

  // ── Texturas próprias da arena ────────────────────────────────

  private buildTextures(): void {
    const makeRect = (key: string, color: number, w: number, h: number) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    if (!this.textures.exists('patrick-stone')) {
      const g = this.add.graphics();
      g.fillStyle(0xffb74d, 1);
      g.fillCircle(12, 12, 12);
      g.generateTexture('patrick-stone', 24, 24);
      g.destroy();
    }

    makeRect('phase1-ground', 0x3e2723, CONSTANTS.GAME_WIDTH, 50);
    makeRect('phase1-platform', 0x4e342e, 220, 20);
    makeRect('phase1-platform-sm', 0x4e342e, 200, 20);

    if (!this.textures.exists('cotton')) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(18, 18, 18);
      g.fillCircle(6, 22, 11);
      g.fillCircle(30, 22, 11);
      g.fillCircle(18, 8, 10);
      g.generateTexture('cotton', 36, 36);
      g.destroy();
    }
  }

  // ── Tufos de algodão ──────────────────────────────────────────

  private setupCottonPool(): void {
    for (let i = 0; i < 10; i++) {
      const c = this.add.container(-100, -100).setDepth(3);
      c.add(this.add.image(0, 0, 'cotton'));
      c.setVisible(false);
      this.cottonPool.push(c);
    }
  }

  private scheduleCottonSpawn(delay: number = CONSTANTS.COTTON_SPAWN_INTERVAL): void {
    this.cottonTimer?.remove();
    this.cottonTimer = this.time.addEvent({
      delay,
      loop: true,
      callback: this.spawnCotton,
      callbackScope: this,
    });
  }

  private spawnCotton(): void {
    if (this.isGameOver) return;
    const inactive = this.cottonPool.find((c) => !this.cottonActive.has(c));
    if (!inactive) return;
    const fromLeft = Math.random() < 0.5;
    const { width } = this.scale;
    const x = fromLeft ? -20 : width + 20;
    const y = Phaser.Math.Between(150, 550);
    inactive.setPosition(x, y).setVisible(true);
    this.cottonActive.add(inactive);
    this.tweens.add({
      targets: inactive,
      x: fromLeft ? width + 60 : -60,
      duration: ((width + 80) / 120) * 1000,
      ease: 'Linear',
      onComplete: () => {
        inactive.setVisible(false).setPosition(-100, -100);
        this.cottonActive.delete(inactive);
      },
    });
  }

  private checkCottonOverlap(): void {
    const pb = this.plankton.getBounds();
    for (const cotton of this.cottonActive) {
      const cb = new Phaser.Geom.Rectangle(cotton.x - 18, cotton.y - 18, 36, 36);
      if (Phaser.Geom.Intersects.RectangleToRectangle(pb, cb)) {
        this.cottonActive.delete(cotton);
        cotton.setVisible(false).setPosition(-100, -100);
        this.plankton.applySlowEffect(CONSTANTS.COTTON_SLOW_DURATION);
      }
    }
  }
}
