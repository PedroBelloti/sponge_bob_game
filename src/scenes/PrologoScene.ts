import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { BobEsponja } from '../entities/BobEsponja';
import { RoboPlankton } from '../entities/bosses/RoboPlankton';
import type { ProjectileData } from '../entities/bosses/BaseBoss';
import { DIALOG_PROLOGO } from '../data/dialogs';
import {
  ATTACK_PALETTES,
  COLORS_CSS,
  caption,
  fadeInScene,
  impactBurst,
  makeGlowTexture,
  makeParticleDot,
  mono,
} from '../config/theme';

export class PrologoScene extends Phaser.Scene {
  private bob!: BobEsponja;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private roboPlankton!: RoboPlankton;
  private projectilePool!: Phaser.Physics.Arcade.Group;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private roboHpBar!: Phaser.GameObjects.Graphics;
  private roboHpShown: number = 1; // ratio desenhado, com lerp para suavizar
  private roboTrail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hearts: Phaser.GameObjects.Image[] = [];
  private narrativeActive: boolean = false;

  constructor() {
    super({ key: 'PrologoScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    fadeInScene(this);
    this.narrativeActive = false;
    this.hearts = [];
    this.roboHpShown = 1;

    this.buildTextures();

    this.add.image(width / 2, height / 2, 'bg-prologo');

    this.add
      .text(16, 16, '◆ SIRI CASCUDO', caption(12, COLORS_CSS.gold))
      .setShadow(1, 1, '#000000', 2);
    this.add
      .text(width / 2, 36, 'Proteja o Siri Cascudo! O Plankton está atacando!', mono(13, COLORS_CSS.text))
      .setOrigin(0.5, 0)
      .setShadow(1, 1, '#000000', 2);

    // Rastro dos tiros do robô (frequency -1 = manual, emitido no cull loop)
    this.roboTrail = this.add
      .particles(0, 0, makeParticleDot(this), {
        lifespan: 220,
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.5, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        tint: ATTACK_PALETTES.robo.mid,
        frequency: -1,
      })
      .setDepth(3);

    // ── Chão ──────────────────────────────────────────────────
    this.ground = this.physics.add.staticGroup();
    // Invisível: o piso visual vem do próprio cenário (imagem)
    const ground = this.ground.create(width / 2, height - 20, 'ground') as Phaser.Physics.Arcade.Sprite;
    ground.refreshBody();
    ground.setVisible(false);

    // ── Plataformas ───────────────────────────────────────────
    this.buildPlatforms();

    // ── Bob ───────────────────────────────────────────────────
    this.bob = new BobEsponja(this, 200, height - 120);
    this.physics.add.collider(this.bob, this.ground);
    this.physics.add.collider(this.bob, this.platforms);

    // ── RoboPlankton ──────────────────────────────────────────
    this.roboPlankton = new RoboPlankton(this, height - 40);

    // ── Pool de projéteis do robô ─────────────────────────────
    this.projectilePool = this.physics.add.group({ maxSize: 30 });

    // ── Overlap projéteis do robô → Bob ───────────────────────
    this.physics.add.overlap(
      this.bob,
      this.projectilePool,
      (_bob, _proj) => {
        const proj = _proj as Phaser.Physics.Arcade.Sprite;
        const damage = proj.getData('damage') as number ?? 1;
        impactBurst(this, proj.x, proj.y, ATTACK_PALETTES.robo);
        this.deactivateProjectile(proj);
        if (this.bob.receiveDamage(damage)) this.updateHUD();
      },
      undefined,
      this,
    );

    // ── Barra de HP do robô ───────────────────────────────────
    this.roboHpBar = this.add.graphics().setDepth(5);

    // ── HUD de vidas ──────────────────────────────────────────
    this.buildHUD(width);

    // ── Controles ─────────────────────────────────────────────
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dashKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.input.mouse?.disableContextMenu();

    EventBus.on('prologo:bob-derrotado', this.onBobDefeated, this);

    // Phaser não chama método shutdown() automaticamente — limpeza via evento
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('prologo:bob-derrotado', this.onBobDefeated);
    });
  }

  // ── Plataformas ───────────────────────────────────────────────

  private buildPlatforms(): void {
    // Escada acessível para o pulo de 169px do Bob (chão a 680):
    // laterais (topo ~538) → central (~433). One-way: atravessa por baixo.
    this.platforms = this.physics.add.staticGroup();
    [[390, 550], [640, 445], [890, 550]].forEach(([x, y]) => {
      const p = this.platforms.create(x, y, 'platform') as Phaser.Physics.Arcade.Sprite;
      p.refreshBody();
      const body = p.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
    });
  }

  // ── HUD ───────────────────────────────────────────────────────

  private buildHUD(width: number): void {
    for (let i = 0; i < 3; i++) {
      this.hearts.push(
        this.add.image(width - 20 - 14 - i * 40, 34, 'heart').setDepth(10),
      );
    }
  }

  private updateHUD(): void {
    const hp = this.bob.getHp();
    const heart = this.hearts[2 - hp];
    if (!heart?.visible) return;
    this.tweens.add({
      targets: heart, scaleX: 0, scaleY: 0,
      duration: 300, ease: 'Linear',
      onComplete: () => heart.setVisible(false),
    });
  }

  // ── Pool ──────────────────────────────────────────────────────

  private spawnProjectile(data: ProjectileData): void {
    const p = this.projectilePool.get(data.x, data.y, 'projectile') as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;
    p.setActive(true).setVisible(true);
    p.setBlendMode(Phaser.BlendModes.ADD); // textura tem glow assado
    p.setData('damage', data.damage);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(data.x, data.y);
    body.setAllowGravity(false);
    body.setVelocity(data.velocityX, data.velocityY);
  }

  private deactivateProjectile(p: Phaser.Physics.Arcade.Sprite): void {
    p.setActive(false).setVisible(false);
    (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // ── HP bar ────────────────────────────────────────────────────

  private drawRoboHpBar(): void {
    const barW = 120;
    const barH = 10;
    const barX = this.roboPlankton.x - barW / 2;
    const barY = this.roboPlankton.y - 290;
    const ratio = this.roboPlankton.getHpPercent();

    // Lerp suaviza a queda em vez de "pular" para o novo valor
    this.roboHpShown += (ratio - this.roboHpShown) * 0.15;
    if (Math.abs(this.roboHpShown - ratio) < 0.002) this.roboHpShown = ratio;

    this.roboHpBar.clear();
    this.roboHpBar.fillStyle(0x05142e, 0.9);
    this.roboHpBar.fillRoundedRect(barX, barY, barW, barH, barH / 2);

    const fillColor = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffd400 : 0xff1744;
    if (this.roboHpShown > 0.01) {
      this.roboHpBar.fillStyle(fillColor, 1);
      this.roboHpBar.fillRoundedRect(
        barX + 1,
        barY + 1,
        Math.max(barH - 2, (barW - 2) * this.roboHpShown),
        barH - 2,
        (barH - 2) / 2,
      );
    }
  }

  // ── Virada narrativa ──────────────────────────────────────────

  private onBobDefeated(): void {
    if (this.narrativeActive) return;
    this.narrativeActive = true;

    const { width, height } = this.scale;
    this.time.delayedCall(1000, () => {
      const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000).setAlpha(0).setDepth(50);
      this.tweens.add({
        targets: overlay, alpha: 1, duration: 800,
        onComplete: () => {
          const txt = this.add
            .text(width / 2, height / 2, '◆ CARREGANDO', caption(14))
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(51);
          this.tweens.add({ targets: txt, alpha: 1, duration: 400 });
          // Reticências animadas — a pausa narrativa "respira"
          const dots = this.add
            .text(width / 2 + 64, height / 2, '', caption(14))
            .setOrigin(0, 0.5)
            .setDepth(51);
          let n = 0;
          this.time.addEvent({
            delay: 350,
            repeat: 4,
            callback: () => dots.setText('.'.repeat((n++ % 3) + 1)),
          });
          this.time.delayedCall(1500, () => {
            EventBus.off('prologo:bob-derrotado', this.onBobDefeated);
            this.scene.start('DialogScene', DIALOG_PROLOGO);
          });
        },
      });
    });
  }

  // ── Loop ──────────────────────────────────────────────────────

  update(time: number): void {
    if (this.narrativeActive) return;

    this.bob.update(this.wasd, this.spaceKey, this.dashKey, this.input.activePointer, time);

    // RoboPlankton decide quando e quantos projéteis lançar
    const shots = this.roboPlankton.update(time, this.bob.x, this.bob.y);
    shots.forEach((data) => this.spawnProjectile(data));

    const { width, height } = this.scale;

    // Desativar projéteis fora da tela + rastro luminoso
    this.projectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;
      if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        this.deactivateProjectile(p);
        return;
      }
      this.roboTrail.emitParticleAt(p.x, p.y);
    });

    // Balas do Bob: hit no robô ou saída de tela
    const roboBounds = this.roboPlankton.getHitBounds();
    this.bob.getProjectileGroup().getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(p.getBounds(), roboBounds)) {
        impactBurst(this, p.x, p.y, ATTACK_PALETTES.bob);
        this.deactivateProjectile(p);
        this.roboPlankton.receiveDamage(CONSTANTS.BOB_PROJECTILE_DAMAGE);
        return;
      }
      if (p.x > width + 20 || p.x < -20 || p.y < -20 || p.y > height + 20) {
        this.deactivateProjectile(p);
      }
    });

    this.drawRoboHpBar();
  }

  // ── Texturas ──────────────────────────────────────────────────

  private buildTextures(): void {
    const makeRect = (key: string, color: number, w: number, h: number) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    makeRect('bob-placeholder', 0xffd700, 48, 64);
    makeRect('ground', 0x0d47a1, CONSTANTS.GAME_WIDTH, 40);

    // Deck de navio do Siri Cascudo: tábuas de madeira, frisos e pregos
    if (!this.textures.exists('platform')) {
      const w = 210;
      const h = 24;
      const g = this.add.graphics();

      // Tábua base com sombra inferior
      g.fillStyle(0x6d4c41, 1);
      g.fillRoundedRect(0, 2, w, h - 2, 5);
      g.fillStyle(0x4e342e, 1);
      g.fillRoundedRect(0, h - 6, w, 6, { tl: 0, tr: 0, bl: 5, br: 5 });

      // Topo claro — superfície pisável
      g.fillStyle(0xa1887f, 1);
      g.fillRoundedRect(0, 0, w, 6, { tl: 5, tr: 5, bl: 0, br: 0 });

      // Frisos verticais separando as tábuas
      g.lineStyle(1.5, 0x3e2723, 0.8);
      [0.25, 0.5, 0.75].forEach((fx) => g.lineBetween(w * fx, 2, w * fx, h - 4));

      // Pregos dourados
      g.fillStyle(0xffd400, 0.9);
      [0.12, 0.38, 0.62, 0.88].forEach((fx) => g.fillCircle(w * fx, 13, 2));

      g.generateTexture('platform', w, h);
      g.destroy();
    }

    // Tiro do robô — laranja vilão-tech com glow assado
    makeGlowTexture(this, 'projectile', ATTACK_PALETTES.robo, 13);

    // Coração de vida do Bob — vermelho com brilho interno
    if (!this.textures.exists('heart')) {
      const g = this.add.graphics();
      g.fillStyle(0xff1744, 0.35);
      g.fillRoundedRect(0, 0, 28, 28, 8);
      g.fillStyle(0xff1744, 1);
      g.fillRoundedRect(3, 3, 22, 22, 6);
      g.fillStyle(0xff8a80, 0.9);
      g.fillCircle(10, 10, 4);
      g.generateTexture('heart', 28, 28);
      g.destroy();
    }
  }
}
