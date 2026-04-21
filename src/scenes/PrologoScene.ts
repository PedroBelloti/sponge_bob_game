import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { BobEsponja } from '../entities/BobEsponja';

export class PrologoScene extends Phaser.Scene {
  private bob!: BobEsponja;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private bobBullets!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private hudText!: Phaser.GameObjects.Text;
  private spawnTimer!: Phaser.Time.TimerEvent;
  private planktonSprite!: Phaser.GameObjects.Image;
  private planktonHpBar!: Phaser.GameObjects.Graphics;
  private planktonHp: number = 0;
  private readonly planktonMaxHp: number = CONSTANTS.PLANKTON_PROLOGO_HP;
  private narrativeActive: boolean = false;

  constructor() {
    super({ key: 'PrologoScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    this.narrativeActive = false;
    this.planktonHp = this.planktonMaxHp;

    this.buildTextures();

    // ── Fundo ──────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a3a5c);

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

    // ── Bob Esponja ────────────────────────────────────────────
    this.bob = new BobEsponja(this, 200, height - 120);
    this.physics.add.collider(this.bob, this.ground);

    // ── Plankton (vilão) ───────────────────────────────────────
    const groundTop = height - 40;
    this.planktonSprite = this.add.image(width - 110, groundTop, 'plankton-placeholder').setOrigin(0.5, 1);

    this.add
      .text(width - 110, groundTop - 44, 'PLANKTON', {
        fontSize: '11px',
        color: '#4CAF50',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);

    // flutuação leve
    this.tweens.add({
      targets: this.planktonSprite,
      y: groundTop - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // HP bar — redesenhada a cada frame em drawPlanktonHpBar()
    this.planktonHpBar = this.add.graphics().setDepth(5);

    // ── Pool de projéteis do Plankton ──────────────────────────
    this.projectiles = this.physics.add.group({ maxSize: 20 });

    // ── Pool de balas do Bob ───────────────────────────────────
    this.bobBullets = this.physics.add.group({ maxSize: 20 });

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

    // ── HUD ────────────────────────────────────────────────────
    this.hudText = this.add
      .text(width - 16, 16, '❤ ❤ ❤', { fontSize: '20px', color: '#FF4444' })
      .setOrigin(1, 0);

    // ── Controles ──────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

    // Botão direito → Bob atira
    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && !this.narrativeActive) {
        this.fireBobBullet(pointer.worldX, pointer.worldY);
      }
    });

    // ── Timer de spawn ─────────────────────────────────────────
    this.spawnTimer = this.time.addEvent({
      delay: CONSTANTS.PROLOGO_SPAWN_INTERVAL,
      callback: this.spawnProjectile,
      callbackScope: this,
      loop: true,
      startAt: CONSTANTS.PROLOGO_SPAWN_INTERVAL, // aguarda o primeiro intervalo
    });

    EventBus.on('prologo:bob-derrotado', this.onBobDefeated, this);
  }

  // Gera texturas placeholder via Graphics (chamado no início de create)
  private buildTextures(): void {
    const make = (key: string, color: number, w: number, h: number) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    make('bob-placeholder',     0xffd700, 48, 64);
    make('projectile',          0xff1744, 12, 12);
    make('bob-bullet',          0x4dd0e1,  8,  8);
    make('ground',              0x0d47a1, CONSTANTS.GAME_WIDTH, 40);
    make('plankton-placeholder',0x4caf50, 24, 36);
  }

  private spawnProjectile(): void {
    if (this.narrativeActive) return;

    // Projétil parte da posição do Plankton
    const spawnX = this.planktonSprite.x - 12;
    const spawnY = this.planktonSprite.y - this.planktonSprite.displayHeight / 2;

    // group.get() reutiliza inativo ou cria novo (até maxSize)
    const p = this.projectiles.get(spawnX, spawnY, 'projectile') as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;

    p.setTexture('projectile');
    p.setActive(true).setVisible(true);

    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(spawnX, spawnY);
    body.setAllowGravity(false);
    body.setVelocityX(-CONSTANTS.PROLOGO_PROJECTILE_SPEED);
  }

  private fireBobBullet(targetX: number, targetY: number): void {
    const p = this.bobBullets.get(this.bob.x, this.bob.y, 'bob-bullet') as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;

    p.setTexture('bob-bullet');
    p.setActive(true).setVisible(true);

    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(this.bob.x, this.bob.y);
    body.setAllowGravity(false);

    // Snapping para os 8 ângulos (0°, 45°, 90°, 135°, 180°, -135°, -90°, -45°)
    const raw = Phaser.Math.Angle.Between(this.bob.x, this.bob.y, targetX, targetY);
    const angle = Math.round(raw / (Math.PI / 4)) * (Math.PI / 4);
    body.setVelocity(
      Math.cos(angle) * CONSTANTS.BOB_PROLOGO_BULLET_SPEED,
      Math.sin(angle) * CONSTANTS.BOB_PROLOGO_BULLET_SPEED,
    );
  }

  private damagePlankton(): void {
    if (this.planktonHp <= 0) return;
    this.planktonHp = Math.max(0, this.planktonHp - 1);

    // Flash breve no sprite
    this.tweens.add({
      targets: this.planktonSprite,
      alpha: 0.2,
      duration: 60,
      yoyo: true,
    });
  }

  private drawPlanktonHpBar(): void {
    const barW  = 80;
    const barH  = 8;
    const barX  = this.planktonSprite.x - barW / 2;
    const barY  = this.planktonSprite.y - this.planktonSprite.displayHeight - 14;
    const ratio = Math.max(0, this.planktonHp / this.planktonMaxHp);

    this.planktonHpBar.clear();

    // Fundo
    this.planktonHpBar.fillStyle(0x222222, 0.9);
    this.planktonHpBar.fillRect(barX, barY, barW, barH);

    // Preenchimento — verde → amarelo → vermelho
    const fillColor = ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xffd700 : 0xff1744;
    this.planktonHpBar.fillStyle(fillColor, 1);
    this.planktonHpBar.fillRect(barX, barY, barW * ratio, barH);
  }

  private deactivateProjectile(p: Phaser.Physics.Arcade.Sprite): void {
    p.setActive(false).setVisible(false);
    (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private updateHUD(): void {
    const hp = this.bob.getHp();
    this.hudText.setText([0, 1, 2].map((i) => (i < hp ? '❤' : '🖤')).join(' '));
  }

  private onBobDefeated(): void {
    if (this.narrativeActive) return;
    this.narrativeActive = true;
    this.spawnTimer.paused = true;

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

  update(): void {
    if (this.narrativeActive) return;

    this.bob.update(this.cursors, this.wasd);

    const { width, height } = this.scale;

    // Desativa projéteis do Plankton que saíram pela esquerda
    this.projectiles.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (p.active && p.x < -20) this.deactivateProjectile(p);
    });

    // Balas do Bob: checar hit no Plankton ou saída de tela
    const planktonBounds = this.planktonSprite.getBounds();
    this.bobBullets.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;

      if (Phaser.Geom.Intersects.RectangleToRectangle(p.getBounds(), planktonBounds)) {
        this.deactivateProjectile(p);
        this.damagePlankton();
        return;
      }

      if (p.x > width + 20 || p.x < -20 || p.y < -20 || p.y > height + 20) {
        this.deactivateProjectile(p);
      }
    });

    this.drawPlanktonHpBar();
  }

  shutdown(): void {
    EventBus.off('prologo:bob-derrotado', this.onBobDefeated);
  }
}
