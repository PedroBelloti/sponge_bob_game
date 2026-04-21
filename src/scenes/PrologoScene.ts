import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { BobEsponja } from '../entities/BobEsponja';
import { RoboPlankton } from '../entities/RoboPlankton';

export class PrologoScene extends Phaser.Scene {
  private bob!: BobEsponja;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private roboPlankton!: RoboPlankton;
  private bobBullets!: Phaser.Physics.Arcade.Group;
  private roboHpBar!: Phaser.GameObjects.Graphics;
  private hearts: Phaser.GameObjects.Image[] = [];
  private bobLastFireTime: number = 0;
  private narrativeActive: boolean = false;

  constructor() {
    super({ key: 'PrologoScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.narrativeActive = false;
    this.hearts = [];

    this.buildTextures();

    // ── Fundo ──────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a3a5c);
    this.buildBackground(height);

    this.add.text(16, 16, 'SIRI CASCUDO', { fontSize: '16px', color: '#FFD700' });
    this.add
      .text(width / 2, 36, 'Proteja o Siri Cascudo! O Plankton está atacando!', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'italic',
      })
      .setOrigin(0.5, 0);

    // ── Chão estático ──────────────────────────────────────────
    this.ground = this.physics.add.staticGroup();
    const groundSprite = this.ground.create(width / 2, height - 20, 'ground') as Phaser.Physics.Arcade.Sprite;
    groundSprite.refreshBody();

    // ── Plataformas ────────────────────────────────────────────
    this.buildPlatforms();

    // ── Bob Esponja ────────────────────────────────────────────
    this.bob = new BobEsponja(this, 200, height - 120);
    this.physics.add.collider(this.bob, this.ground);
    this.physics.add.collider(this.bob, this.platforms);

    // ── RoboPlankton ───────────────────────────────────────────
    this.roboPlankton = new RoboPlankton(this, height - 40);

    // ── Pool de projéteis do RoboPlankton (30 círculos laranja) ─
    this.projectiles = this.physics.add.group({ maxSize: 30 });

    // ── Pool de balas do Bob ───────────────────────────────────
    this.bobBullets = this.physics.add.group({ maxSize: 20 });

    // ── Barra de HP do robô ────────────────────────────────────
    this.roboHpBar = this.add.graphics().setDepth(5);

    this.physics.add.overlap(
      this.bob,
      this.projectiles,
      (_bob, _proj) => {
        const proj = _proj as Phaser.Physics.Arcade.Sprite;
        this.deactivateProjectile(proj);
        this.bob.receiveDamage();
        this.updateHUD();
      },
      undefined,
      this,
    );

    // ── HUD de vidas ───────────────────────────────────────────
    this.buildHUD(width);

    // ── Controles ──────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

    this.input.mouse?.disableContextMenu();

    // ── Disparo escalonado do robô ─────────────────────────────
    this.scheduleNextShot();

    EventBus.on('prologo:bob-derrotado', this.onBobDefeated, this);
  }

  // ── Background ───────────────────────────────────────────────

  private buildBackground(height: number): void {
    // Raios de luz verticais
    [200, 700, 1100].forEach((x) => {
      this.add.rectangle(x, height / 2, 80, height, 0xffffff).setAlpha(0.03);
    });

    // Bolhas estáticas de fundo
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 0.06);
    (
      [
        [150, 400, 8],
        [400, 200, 5],
        [550, 580, 10],
        [750, 150, 4],
        [850, 350, 12],
        [1050, 480, 6],
        [1150, 230, 9],
        [300, 650, 7],
      ] as [number, number, number][]
    ).forEach(([x, y, r]) => gfx.fillCircle(x, y, r));
  }

  // ── Plataformas ───────────────────────────────────────────────

  private buildPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();
    // [topLeftX, topLeftY] — todas com width=180, height=20
    const defs: [number, number][] = [
      [300, 520],
      [600, 420],
      [900, 500],
    ];
    defs.forEach(([x, y]) => {
      const plat = this.platforms.create(x + 90, y + 10, 'platform') as Phaser.Physics.Arcade.Sprite;
      plat.refreshBody();
    });
  }

  // ── HUD ───────────────────────────────────────────────────────

  private buildHUD(width: number): void {
    // Três corações no topo direito, espaçamento 12px, padding 20px
    for (let i = 0; i < 3; i++) {
      const x = width - 20 - 14 - i * 40; // 28px wide + 12px gap = 40
      const heart = this.add.image(x, 34, 'heart').setDepth(10);
      this.hearts.push(heart);
    }
  }

  private updateHUD(): void {
    const hp = this.bob.getHp();
    // hearts[0] = rightmost (lost when hp drops 3→2), hearts[2] = leftmost (lost 1→0)
    const lostIndex = 2 - hp;
    const heart = this.hearts[lostIndex];
    if (!heart || !heart.visible) return;

    this.tweens.add({
      targets: heart,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      ease: 'Linear',
      onComplete: () => heart.setVisible(false),
    });
  }

  // ── Sistema de disparo ────────────────────────────────────────

  private getCurrentPhaseData(): { count: number; interval: number; spread: number } {
    const hpRatio = this.roboPlankton.getHp() / RoboPlankton.MAX_HP;
    if (hpRatio > 0.5) return { count: 1, interval: 2000, spread: 0 };
    return                    { count: 3, interval: 1400, spread: 8 };
  }

  private scheduleNextShot(): void {
    const { interval } = this.getCurrentPhaseData();
    this.time.delayedCall(interval, () => {
      if (this.narrativeActive) return;
      const { count, spread } = this.getCurrentPhaseData();
      this.fireVolley(count, spread);
      this.scheduleNextShot();
    });
  }

  private fireVolley(count: number, spread: number): void {
    const shot = this.roboPlankton.fireProjectile(this.bob.x, this.bob.y);
    const baseAngle = Math.atan2(shot.vy, shot.vx);
    const spreadRad = Phaser.Math.DegToRad(spread);
    const speed = CONSTANTS.PROLOGO_ROBO_PROJECTILE_SPEED;

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : spreadRad * (i - (count - 1) / 2);
      const angle = baseAngle + offset;
      this.spawnSingleProjectile(shot.x, shot.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  private spawnSingleProjectile(x: number, y: number, vx: number, vy: number): void {
    const p = this.projectiles.get(x, y, 'projectile') as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;

    p.setActive(true).setVisible(true);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(x, y);
    body.setAllowGravity(false);
    body.setVelocity(vx, vy);
  }

  private deactivateProjectile(p: Phaser.Physics.Arcade.Sprite): void {
    p.setActive(false).setVisible(false);
    (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private fireBobBullet(targetX: number, targetY: number): void {
    const p = this.bobBullets.get(this.bob.x, this.bob.y, 'bob-bullet') as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;

    p.setActive(true).setVisible(true);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(this.bob.x, this.bob.y);
    body.setAllowGravity(false);

    // Snap para 8 direções para manter o estilo cartoon
    const raw = Phaser.Math.Angle.Between(this.bob.x, this.bob.y, targetX, targetY);
    const angle = Math.round(raw / (Math.PI / 6)) * (Math.PI / 6);
    body.setVelocity(
      Math.cos(angle) * CONSTANTS.BOB_PROLOGO_BULLET_SPEED,
      Math.sin(angle) * CONSTANTS.BOB_PROLOGO_BULLET_SPEED,
    );
  }

  private drawRoboHpBar(): void {
    const barW = 120;
    const barH = 10;
    const barX = this.roboPlankton.x - barW / 2;
    const barY = this.roboPlankton.y - 210;
    const ratio = this.roboPlankton.getHp() / RoboPlankton.MAX_HP;

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
      const blackOverlay = this.add
        .rectangle(width / 2, height / 2, width, height, 0x000000)
        .setAlpha(0)
        .setDepth(50);

      this.tweens.add({
        targets: blackOverlay,
        alpha: 1,
        duration: 800,
        onComplete: () => {
          const t1 = this.add
            .text(width / 2, height / 2, 'Mas essa não é a história que você pensa que é...', {
              fontSize: '32px',
              color: '#FFD700',
              fontStyle: 'italic',
              wordWrap: { width: width * 0.8 },
              align: 'center',
            })
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(51);

          this.tweens.add({ targets: t1, alpha: 1, duration: 600 });

          this.time.delayedCall(3000, () => {
            const t2 = this.add
              .text(width / 2, height / 2 + 80, 'Você sempre foi o Plankton.', {
                fontSize: '24px',
                color: '#ffffff',
              })
              .setOrigin(0.5)
              .setAlpha(0)
              .setDepth(51);

            this.tweens.add({ targets: t2, alpha: 1, duration: 600 });

            this.time.delayedCall(2500, () => {
              EventBus.off('prologo:bob-derrotado', this.onBobDefeated);
              this.scene.start('Phase1Scene');
            });
          });
        },
      });
    });
  }

  // ── Loop de jogo ──────────────────────────────────────────────

  update(): void {
    if (this.narrativeActive) return;

    this.bob.update(this.cursors, this.wasd);

    // Disparo do Bob: botão esquerdo mantido → ritmo fixo independente de quantos cliques
    const pointer = this.input.activePointer;
    if (pointer.leftButtonDown()) {
      const now = this.time.now;
      if (now - this.bobLastFireTime >= CONSTANTS.BOB_PROLOGO_FIRE_INTERVAL) {
        this.fireBobBullet(pointer.worldX, pointer.worldY);
        this.bobLastFireTime = now;
      }
    }

    const { width, height } = this.scale;

    // Projéteis do robô: desativar ao sair da tela
    this.projectiles.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (p.active && (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20)) {
        this.deactivateProjectile(p);
      }
    });

    // Balas do Bob: hit no robô ou saída de tela
    const roboBounds = this.roboPlankton.getHitBounds();
    this.bobBullets.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;

      if (Phaser.Geom.Intersects.RectangleToRectangle(p.getBounds(), roboBounds)) {
        this.deactivateProjectile(p);
        this.roboPlankton.receiveDamage(1);
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

  // ── Texturas placeholder ──────────────────────────────────────

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
    makeRect('bob-bullet', 0x4dd0e1, 8, 8);
    makeRect('ground', 0x0d47a1, CONSTANTS.GAME_WIDTH, 40);
    makeRect('platform', 0x0d47a1, 180, 20);

    // Projétil: círculo laranja #FF6F00, raio 10px → textura 20×20
    if (!this.textures.exists('projectile')) {
      const g = this.add.graphics();
      g.fillStyle(0xff6f00, 1);
      g.fillCircle(10, 10, 10);
      g.generateTexture('projectile', 20, 20);
      g.destroy();
    }

    // Coração do HUD: retângulo arredondado #FF1744, 28×28
    if (!this.textures.exists('heart')) {
      const g = this.add.graphics();
      g.fillStyle(0xff1744, 1);
      g.fillRoundedRect(0, 0, 28, 28, 4);
      g.generateTexture('heart', 28, 28);
      g.destroy();
    }
  }
}
