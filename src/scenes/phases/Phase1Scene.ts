import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { Patrick } from '../../entities/bosses/Patrick';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_PATRICK } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';
import { ATTACK_PALETTES, COLORS_CSS, caption, display, makeGlowTexture } from '../../config/theme';
import type { AttackPalette } from '../../config/theme';

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

    this.add.image(width / 2, height / 2, 'bg-patrick');

    this.add
      .text(16, 16, '◆ CASA DO PATRICK', caption(12, COLORS_CSS.text))
      .setShadow(1, 1, '#000000', 2);

    this.ground = this.physics.add.staticGroup();
    // Invisível: o gramado da imagem faz o papel de piso
    const ground = this.ground.create(width / 2, height - 25, 'phase1-ground') as Phaser.Physics.Arcade.Sprite;
    ground.refreshBody();
    ground.setVisible(false);

    // Escada acessível: chão (670) → laterais (topo ~543) → central (~433).
    // Degraus de ~110-127px, dentro do pulo de 144px do Plankton, e one-way
    // para subir atravessando por baixo.
    this.platforms = this.physics.add.staticGroup();
    const defs: [number, number, string][] = [
      [220, 555, 'phase1-platform-sm'],
      [640, 445, 'phase1-platform'],
      [1050, 555, 'phase1-platform-sm'],
    ];
    defs.forEach(([x, y, key]) => this.addOneWayPlatform(x, y, key));
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
    return ATTACK_PALETTES.patrick.mid;
  }

  protected getBossPalette(): AttackPalette {
    return ATTACK_PALETTES.patrick;
  }

  protected getBossName(): string {
    return 'PATRICK ESTRELA';
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
      .text(width / 2, height / 2, 'Patrick ficou irritado!', display(24, '#ff8a65'))
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0.6);
    this.tweens.add({ targets: msg, scale: 1, duration: 250, ease: 'Back.easeOut' });
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

    // Pedra do Patrick — coral de estrela-do-mar com glow assado
    makeGlowTexture(this, 'patrick-stone', ATTACK_PALETTES.patrick, 15);

    makeRect('phase1-ground', 0x3e2723, CONSTANTS.GAME_WIDTH, 50);
    this.makeCoralPlatform('phase1-platform', 250);
    this.makeCoralPlatform('phase1-platform-sm', 220);

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

  /**
   * Plataforma de rocha de coral — jardim do Patrick: corpo rosado e
   * arredondado, poros escuros e topo de areia clara para marcar onde pisar.
   */
  private makeCoralPlatform(key: string, w: number): void {
    if (this.textures.exists(key)) return;
    const h = 26;
    const g = this.add.graphics();

    // Corpo de coral arredondado com sombra inferior
    g.fillStyle(0xc75b4a, 1);
    g.fillRoundedRect(0, 4, w, h - 4, { tl: 12, tr: 12, bl: 8, br: 8 });
    g.fillStyle(0x9c4233, 1);
    g.fillRoundedRect(0, h - 8, w, 8, { tl: 0, tr: 0, bl: 8, br: 8 });

    // Topo de areia clara — superfície pisável bem legível
    g.fillStyle(0xffe0b2, 1);
    g.fillRoundedRect(0, 0, w, 8, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.fillStyle(0xffcc80, 1);
    [0.18, 0.45, 0.72].forEach((fx) => g.fillCircle(w * fx, 4, 2));

    // Poros do coral
    g.fillStyle(0x7e342a, 0.8);
    [0.12, 0.3, 0.52, 0.68, 0.88].forEach((fx, i) =>
      g.fillCircle(w * fx, 14 + (i % 2) * 6, 2.5),
    );

    g.generateTexture(key, w, h);
    g.destroy();
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
