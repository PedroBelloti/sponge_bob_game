import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { EventBus } from '../../core/EventBus';
import type { BossId } from '../../core/EventBus';
import { Plankton } from '../../entities/Plankton';
import { Patrick } from '../../entities/bosses/Patrick';
import type { ProjectileData } from '../../entities/bosses/BaseBoss';
import { DIALOG_PATRICK } from '../../data/dialogs';

export class Phase1Scene extends Phaser.Scene {
  private plankton!: Plankton;
  private patrick!: Patrick;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dashKey!: Phaser.Input.Keyboard.Key;

  private bossProjectilePool!: Phaser.Physics.Arcade.Group;
  private patrickHpFill!: Phaser.GameObjects.Rectangle;

  // Cotton pool
  private cottonPool: Phaser.GameObjects.Container[] = [];
  private cottonActive: Set<Phaser.GameObjects.Container> = new Set();

  // HUD
  private planktonHearts: Phaser.GameObjects.Arc[] = [];
  private planktonHpLast: number = CONSTANTS.PLANKTON_MAX_HP;

  constructor() {
    super({ key: 'Phase1Scene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.buildTextures();
    this.buildBackground(width, height);
    this.buildGround(width, height);
    this.buildPlatforms();
    this.buildPatrick(height);
    this.buildPatrickHpBar(width);
    this.buildPlankton(height);
    this.buildBossProjectilePool();
    this.setupOverlaps();
    this.buildHUD(width);
    this.buildControls(width, height);
    this.setupCottonPool();
    this.scheduleCottonSpawn();

    EventBus.on('boss:damaged',     this.onBossDamaged,    this);
    EventBus.on('boss:defeated',    this.onBossDefeated,   this);
    EventBus.on('boss:final-phase', this.onBossFinalPhase, this);

    // Garante Plankton ativo ao retomar após pausa da DialogScene
    this.events.on('resume', () => {
      if (this.plankton) {
        this.plankton.setActive(true);
        this.plankton.setVisible(true);
      }
    });

    // Diálogo com Patrick antes da luta — só na primeira vez
    const sceneData = this.sys.settings.data as { bossDialogDone?: boolean } | undefined;
    if (!sceneData?.bossDialogDone) {
      this.scene.launch('DialogScene', DIALOG_PATRICK);
      this.scene.bringToTop('DialogScene'); // garante renderização acima de Phase1Scene
      this.scene.pause();
    }
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

    if (!this.textures.exists('plankton-placeholder')) {
      const g = this.add.graphics();
      g.lineStyle(2, 0x2e7d32, 1);
      g.beginPath();
      g.moveTo(18, 12); g.lineTo(10, 2);
      g.moveTo(22, 12); g.lineTo(30, 2);
      g.strokePath();
      g.fillStyle(0x4caf50, 1); g.fillCircle(20, 24, 20);
      g.fillStyle(0xff1744, 1); g.fillCircle(20, 20, 8);
      g.fillStyle(0x000000, 1); g.fillCircle(22, 20, 4);
      g.generateTexture('plankton-placeholder', 40, 44);
      g.destroy();
    }

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

  // ── Cenário ───────────────────────────────────────────────────

  private buildBackground(width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, 0x1c0a00);

    const light = this.add.rectangle(width / 2, height / 2, 200, height, 0xffd700).setAlpha(0.06);
    this.tweens.add({ targets: light, alpha: 0.08, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(16, 16, 'DEBAIXO DA PEDRA', { fontSize: '14px', color: '#8D6E63' });
  }

  private buildGround(width: number, height: number): void {
    this.ground = this.physics.add.staticGroup();
    (this.ground.create(width / 2, height - 25, 'phase1-ground') as Phaser.Physics.Arcade.Sprite).refreshBody();
  }

  private buildPlatforms(): void {
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

  // ── Patrick ───────────────────────────────────────────────────

  private buildPatrick(height: number): void {
    // Patrick center: feet at height-50, body height=120 → center at height-110
    this.patrick = new Patrick(this, 1000, height - 110);
    this.patrick.setDepth(2);
  }

  private buildPatrickHpBar(width: number): void {
    const barW = 300;
    const cx = width / 2;
    const y = 40;
    this.add.rectangle(cx, y, barW, 20, 0x333333).setDepth(5);
    this.patrickHpFill = this.add.rectangle(cx, y, barW, 20, 0xff8a65).setDepth(6);
  }

  // ── Plankton ──────────────────────────────────────────────────

  private buildPlankton(height: number): void {
    this.plankton = new Plankton(this, 150, height - 50 - 44);
    this.physics.add.collider(this.plankton, this.ground);
    this.physics.add.collider(this.plankton, this.platforms);

    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dashKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.input.mouse?.disableContextMenu();
  }

  // ── Boss pool ─────────────────────────────────────────────────

  private buildBossProjectilePool(): void {
    this.bossProjectilePool = this.physics.add.group({ maxSize: this.patrick.getConfig().projectilePoolSize });
  }

  private spawnBossProjectile(data: ProjectileData): void {
    const p = this.bossProjectilePool.get(data.x, data.y, 'patrick-stone') as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;
    p.setActive(true).setVisible(true);
    p.setData('damage', data.damage);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(data.x, data.y);
    body.setAllowGravity(false);
    body.setVelocity(data.velocityX, data.velocityY);
  }

  private deactivateBossProjectile(p: Phaser.Physics.Arcade.Sprite): void {
    p.setActive(false).setVisible(false);
    (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  // ── Overlaps ──────────────────────────────────────────────────

  private setupOverlaps(): void {
    // Boss projectiles → Plankton
    this.physics.add.overlap(
      this.plankton,
      this.bossProjectilePool,
      (_player, _proj) => {
        const proj = _proj as Phaser.Physics.Arcade.Sprite;
        const damage = proj.getData('damage') as number ?? 1;
        this.deactivateBossProjectile(proj);
        if (this.plankton.receiveDamage(damage)) this.updateHUD();
      },
      undefined,
      this,
    );
  }

  // Plankton laser → Patrick (geometric, Container has no physics body)
  private checkLaserPatrickOverlap(): void {
    const patrickRect = this.patrick.getHitBounds();
    this.plankton.getProjectileGroup().getChildren().forEach((obj) => {
      const laser = obj as Phaser.Physics.Arcade.Sprite;
      if (!laser.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(laser.getBounds(), patrickRect)) {
        laser.setActive(false).setVisible(false);
        (laser.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.patrick.receiveDamage(CONSTANTS.PLANKTON_LASER_DAMAGE);
      }
    });
  }

  // ── HUD ───────────────────────────────────────────────────────

  private buildHUD(width: number): void {
    const startX = width - 20;
    for (let i = 0; i < CONSTANTS.PLANKTON_MAX_HP; i++) {
      const heart = this.add.arc(startX - 14 - i * 30, 60, 12, 0, 360, false, 0x4caf50).setDepth(10);
      this.planktonHearts.push(heart);
    }
    this.add.text(width - 20, 80, 'PLANKTON', { fontSize: '12px', color: '#4CAF50' }).setOrigin(1, 0).setDepth(10);
  }

  private buildControls(width: number, height: number): void {
    this.add
      .text(width / 2, height - 8, 'WASD Mover   ESPAÇO/W Pular   CLICK Atirar   SHIFT Dash   S Agachar', {
        fontSize: '12px', color: '#8D6E63',
      })
      .setOrigin(0.5, 1)
      .setDepth(10);
  }

  // ── EventBus listeners ────────────────────────────────────────

  private onBossDamaged(data: { currentHp: number; maxHp: number; bossId: BossId }): void {
    if (data.bossId !== 'patrick') return;
    this.patrickHpFill.setDisplaySize(300 * (data.currentHp / data.maxHp), 20);
  }

  private onBossDefeated(data: { bossId: BossId }): void {
    if (data.bossId !== 'patrick') return;

    this.add
      .text(CONSTANTS.GAME_WIDTH / 2, CONSTANTS.GAME_HEIGHT / 2, 'Fragmento recuperado!', {
        fontSize: '28px', color: '#FFD700', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.time.delayedCall(2000, () => {
      this.scene.start('Phase2Scene');
    });
  }

  private onBossFinalPhase(data: { bossId: BossId }): void {
    if (data.bossId !== 'patrick') return;
    const { width, height } = this.scale;
    const msg = this.add
      .text(width / 2, height / 2, 'Patrick ficou irritado!', { fontSize: '24px', color: '#FF8A65' })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
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

  private scheduleCottonSpawn(): void {
    this.time.addEvent({
      delay: CONSTANTS.COTTON_SPAWN_INTERVAL,
      loop: true,
      callback: this.spawnCotton,
      callbackScope: this,
    });
  }

  private spawnCotton(): void {
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

  // ── HUD update ────────────────────────────────────────────────

  private updateHUD(): void {
    const hp = this.plankton.getHp();
    if (hp === this.planktonHpLast) return;
    const lost = this.planktonHpLast - hp;
    for (let i = 0; i < lost; i++) {
      const heart = this.planktonHearts[this.planktonHpLast - 1 - i];
      if (heart?.visible) {
        this.tweens.add({
          targets: heart, scaleX: 0, scaleY: 0, duration: 300,
          onComplete: () => heart.setVisible(false),
        });
      }
    }
    this.planktonHpLast = hp;
  }

  // ── Loop ──────────────────────────────────────────────────────

  update(time: number): void {
    this.plankton.update(this.wasd, this.spaceKey, this.dashKey, this.input.activePointer, time);

    // Patrick decide quando e quais projéteis lançar
    const shots = this.patrick.update(time, this.plankton.x, this.plankton.y);
    shots.forEach((data) => this.spawnBossProjectile(data));

    // Desativar projéteis do boss fora de tela
    const { width, height } = this.scale;
    this.bossProjectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (p.active && (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20)) {
        this.deactivateBossProjectile(p);
      }
    });

    this.checkLaserPatrickOverlap();
    this.checkCottonOverlap();
    this.updateHUD();
  }

  shutdown(): void {
    EventBus.off('boss:damaged',     this.onBossDamaged);
    EventBus.off('boss:defeated',    this.onBossDefeated);
    EventBus.off('boss:final-phase', this.onBossFinalPhase);
  }
}
