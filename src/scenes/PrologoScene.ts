import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { BobEsponja } from '../entities/BobEsponja';
import { RoboPlankton } from '../entities/bosses/RoboPlankton';
import type { ProjectileData } from '../entities/bosses/BaseBoss';
import { DIALOG_PROLOGO } from '../data/dialogs';

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
  private hearts: Phaser.GameObjects.Image[] = [];
  private narrativeActive: boolean = false;

  constructor() {
    super({ key: 'PrologoScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.narrativeActive = false;
    this.hearts = [];

    this.buildTextures();

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a3a5c);
    this.buildBackground(height);

    this.add.text(16, 16, 'SIRI CASCUDO', { fontSize: '16px', color: '#FFD700' });
    this.add
      .text(width / 2, 36, 'Proteja o Siri Cascudo! O Plankton está atacando!', {
        fontSize: '14px', color: '#ffffff', fontStyle: 'italic',
      })
      .setOrigin(0.5, 0);

    // ── Chão ──────────────────────────────────────────────────
    this.ground = this.physics.add.staticGroup();
    (this.ground.create(width / 2, height - 20, 'ground') as Phaser.Physics.Arcade.Sprite).refreshBody();

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
  }

  // ── Background ────────────────────────────────────────────────

  private buildBackground(height: number): void {
    [200, 700, 1100].forEach((x) => {
      this.add.rectangle(x, height / 2, 80, height, 0xffffff).setAlpha(0.03);
    });
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 0.06);
    (
      [
        [150, 400, 8], [400, 200, 5], [550, 580, 10], [750, 150, 4],
        [850, 350, 12], [1050, 480, 6], [1150, 230, 9], [300, 650, 7],
      ] as [number, number, number][]
    ).forEach(([x, y, r]) => gfx.fillCircle(x, y, r));
  }

  // ── Plataformas ───────────────────────────────────────────────

  private buildPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    [[300, 520], [600, 420], [900, 500]].forEach(([x, y]) => {
      (this.platforms.create(x + 90, y + 10, 'platform') as Phaser.Physics.Arcade.Sprite).refreshBody();
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
    const barY = this.roboPlankton.y - 210;
    const ratio = this.roboPlankton.getHpPercent();

    this.roboHpBar.clear();
    this.roboHpBar.fillStyle(0x222222, 0.9);
    this.roboHpBar.fillRect(barX, barY, barW, barH);

    const fillColor = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffd700 : 0xff1744;
    this.roboHpBar.fillStyle(fillColor, 1);
    this.roboHpBar.fillRect(barX, barY, barW * ratio, barH);
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
          const txt = this.add.text(width / 2, height / 2, 'Carregando...', {
            fontSize: '24px', color: '#ffffff',
          }).setOrigin(0.5).setAlpha(0).setDepth(51);
          this.tweens.add({ targets: txt, alpha: 1, duration: 400 });
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

    // Desativar projéteis fora da tela
    this.projectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (p.active && (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20)) {
        this.deactivateProjectile(p);
      }
    });

    // Balas do Bob: hit no robô ou saída de tela
    const roboBounds = this.roboPlankton.getHitBounds();
    this.bob.getProjectileGroup().getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(p.getBounds(), roboBounds)) {
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

  shutdown(): void {
    EventBus.off('prologo:bob-derrotado', this.onBobDefeated);
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
    makeRect('platform', 0x0d47a1, 180, 20);

    if (!this.textures.exists('projectile')) {
      const g = this.add.graphics();
      g.fillStyle(0xff6f00, 1);
      g.fillCircle(10, 10, 10);
      g.generateTexture('projectile', 20, 20);
      g.destroy();
    }

    if (!this.textures.exists('heart')) {
      const g = this.add.graphics();
      g.fillStyle(0xff1744, 1);
      g.fillRoundedRect(0, 0, 28, 28, 4);
      g.generateTexture('heart', 28, 28);
      g.destroy();
    }
  }
}
