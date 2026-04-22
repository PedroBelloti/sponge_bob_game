import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

export interface PlayerStats {
  speed: number;
  jumpVelocity: number;       // negative, e.g. -520
  maxHp: number;
  dashSpeed: number;
  dashDuration: number;       // ms
  dashCooldown: number;       // ms
  projectileDamage: number;
  projectileSpeed: number;
  fireCooldown: number;       // ms
  projectileColor: number;    // hex, e.g. 0xFF6F00
  projectileWidth: number;
  projectileHeight: number;
}

export type WASDKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

export abstract class PlayerBase extends Phaser.Physics.Arcade.Sprite {
  protected stats: PlayerStats;
  protected currentHp: number;
  protected isInvincible: boolean = false;
  protected isDashing: boolean = false;
  protected isCrouching: boolean = false;
  protected isOnGround: boolean = false;
  protected facingRight: boolean = true;
  protected lastDashTime: number = 0;
  protected lastFireTime: number = 0;
  protected isSlowed: boolean = false;
  protected slowMultiplier: number = 1.0;

  protected label: Phaser.GameObjects.Text | null = null;
  protected labelOffsetY: number = 40;

  private projectilePool!: Phaser.Physics.Arcade.Group;
  private airDashUsed: boolean = false;
  private slowTimer: Phaser.Time.TimerEvent | null = null;
  private activeSyncTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, stats: PlayerStats) {
    super(scene, x, y, texture);
    this.stats = stats;
    this.currentHp = stats.maxHp;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.ensureProjectileTexture();
    this.projectilePool = scene.physics.add.group({ maxSize: 15 });
  }

  // ── Abstract interface ────────────────────────────────────────

  abstract onDeath(): void;
  abstract getProjectileTextureKey(): string;

  protected onDashStart(_direction: number): void {}

  // ── Update loop ───────────────────────────────────────────────

  update(
    wasd: WASDKeys,
    spaceKey: Phaser.Input.Keyboard.Key,
    dashKey: Phaser.Input.Keyboard.Key,
    pointer: Phaser.Input.Pointer,
    time: number,
  ): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.isOnGround = body.blocked.down;
    if (this.isOnGround) this.airDashUsed = false;

    this.handleCrouch(wasd);
    this.handleMovement(wasd);
    this.handleJump(wasd, spaceKey);
    this.handleDash(dashKey, time);
    this.handleFire(pointer, time);
    this.cullingProjectiles();

    if (this.label) {
      this.label.setPosition(this.x, this.y - this.labelOffsetY);
    }
  }

  // ── Movement handlers ─────────────────────────────────────────

  private handleMovement(wasd: WASDKeys): void {
    if (this.isDashing) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = this.stats.speed * this.slowMultiplier;

    if (wasd.A.isDown) {
      body.setVelocityX(-speed);
      this.facingRight = false;
      this.setFlipX(true);
    } else if (wasd.D.isDown) {
      body.setVelocityX(speed);
      this.facingRight = true;
      this.setFlipX(false);
    } else {
      body.setVelocityX(0);
    }
  }

  private handleJump(wasd: WASDKeys, spaceKey: Phaser.Input.Keyboard.Key): void {
    if (!this.isOnGround || this.isCrouching) return;
    if (wasd.W.isDown || spaceKey.isDown) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocityY(this.stats.jumpVelocity);
    }
  }

  private handleDash(dashKey: Phaser.Input.Keyboard.Key, time: number): void {
    if (!Phaser.Input.Keyboard.JustDown(dashKey)) return;
    if (time - this.lastDashTime < this.stats.dashCooldown) return;
    if (!this.isOnGround && this.airDashUsed) return;

    if (!this.isOnGround) this.airDashUsed = true;
    this.lastDashTime = time;
    this.isDashing = true;
    this.isInvincible = true;

    const dir = this.facingRight ? 1 : -1;
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * this.stats.dashSpeed);
    this.onDashStart(dir);

    this.scene.time.delayedCall(this.stats.dashDuration, () => {
      this.isDashing = false;
      this.isInvincible = false;
    });
  }

  private handleCrouch(wasd: WASDKeys): void {
    const shouldCrouch = wasd.S.isDown;
    if (shouldCrouch === this.isCrouching) return;

    this.isCrouching = shouldCrouch;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const feetY = body.bottom;
    const fw = this.frame.realWidth;
    const fh = this.frame.realHeight;

    if (this.isCrouching) {
      this.setScale(1, 0.5);
      body.setSize(fw, fh * 0.5, false);
      body.setOffset(0, fh * 0.5);
    } else {
      this.setScale(1, 1);
      body.setSize(fw, fh, false);
      body.setOffset(0, 0);
    }
    this.y = feetY - this.height / 2;
  }

  private handleFire(pointer: Phaser.Input.Pointer, time: number): void {
    if (!pointer.leftButtonDown()) return;
    if (time - this.lastFireTime < this.stats.fireCooldown) return;
    this.lastFireTime = time;

    // Snap para o múltiplo de 30° mais próximo do cursor — 6 ângulos por hemisfério
    const raw = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    const snapped = Math.round(raw / (Math.PI / 6)) * (Math.PI / 6);

    // Vira o personagem para o lado do cursor
    this.facingRight = Math.cos(snapped) >= 0;
    this.setFlipX(!this.facingRight);

    const key = this.getProjectileTextureKey();
    const p = this.projectilePool.get(this.x, this.y, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;

    p.setActive(true).setVisible(true);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(this.x, this.y);
    body.setAllowGravity(false);
    body.setVelocity(
      Math.cos(snapped) * this.stats.projectileSpeed,
      Math.sin(snapped) * this.stats.projectileSpeed,
    );
  }

  private cullingProjectiles(): void {
    const w = CONSTANTS.GAME_WIDTH;
    const h = CONSTANTS.GAME_HEIGHT;
    this.projectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;
      if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        p.setActive(false).setVisible(false);
        (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    });
  }

  // ── Projectile texture ────────────────────────────────────────

  private ensureProjectileTexture(): void {
    const key = this.getProjectileTextureKey();
    if (this.scene.textures.exists(key)) return;
    const g = this.scene.add.graphics();
    g.fillStyle(this.stats.projectileColor, 1);
    g.fillRect(0, 0, this.stats.projectileWidth, this.stats.projectileHeight);
    g.generateTexture(key, this.stats.projectileWidth, this.stats.projectileHeight);
    g.destroy();
  }

  // ── Public API ────────────────────────────────────────────────

  getProjectileGroup(): Phaser.Physics.Arcade.Group {
    return this.projectilePool;
  }

  receiveDamage(amount: number): boolean {
    if (this.isInvincible || this.isDashing) return false;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.isInvincible = true;

    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 150,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.setAlpha(1);
        this.isInvincible = false;
      },
    });

    if (this.currentHp <= 0) {
      this.isInvincible = true;
      this.onDeath();
    }

    return true;
  }

  applySlowEffect(duration: number): void {
    if (this.slowTimer) {
      this.slowTimer.remove();
      this.slowTimer = null;
    }
    if (this.activeSyncTween) {
      this.activeSyncTween.stop();
      this.activeSyncTween = null;
      this.setAlpha(1);
    }

    this.isSlowed = true;
    this.slowMultiplier = 0.4;

    this.activeSyncTween = this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 200,
      yoyo: true,
      repeat: Math.floor(duration / 400),
      onComplete: () => {
        this.setAlpha(1);
        this.activeSyncTween = null;
      },
    });

    this.slowTimer = this.scene.time.delayedCall(duration, () => {
      this.isSlowed = false;
      this.slowMultiplier = 1.0;
      this.slowTimer = null;
    });
  }

  getHp(): number {
    return this.currentHp;
  }

  getCurrentHp(): number {
    return this.currentHp;
  }

  destroy(fromScene?: boolean): void {
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
