import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { makeGlowCapsule, makeGlowTexture, makeParticleDot } from '../config/theme';
import type { AttackPalette } from '../config/theme';

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
  /** Paleta de glow do projétil (trail, muzzle flash, textura assada). */
  palette: AttackPalette;
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
  protected isFrozen: boolean = false;
  protected isSlippery: boolean = false;

  protected label: Phaser.GameObjects.Text | null = null;
  protected labelOffsetY: number = 40;

  // Animação de caminhada (opcional). Subclasses com animação definem a
  // chave; quem usa sprite estático deixa null e mantém o frame fixo.
  protected walkAnimKey: string | null = null;

  // Textura inicial — cada frame da caminhada é uma imagem separada, então
  // "parar no frame 0" significa voltar para esta textura.
  protected readonly idleTextureKey: string;

  private projectilePool!: Phaser.Physics.Arcade.Group;
  private trailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private airDashUsed: boolean = false;
  private slowTimer: Phaser.Time.TimerEvent | null = null;
  private activeSyncTween: Phaser.Tweens.Tween | null = null;
  private freezeTimer: Phaser.Time.TimerEvent | null = null;

  // Game feel — pulo
  private lastGroundedTime: number = -Infinity; // coyote time
  private lastJumpPressTime: number = -Infinity; // jump buffer
  private jumpCutApplied: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, stats: PlayerStats) {
    super(scene, x, y, texture);
    this.idleTextureKey = texture;
    this.stats = stats;
    this.currentHp = stats.maxHp;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.applyBodySize(false); // hitbox um pouco menor que o sprite

    this.ensureProjectileTexture();
    this.projectilePool = scene.physics.add.group({ maxSize: 15 });

    // Rastro compartilhado por todos os projéteis (frequency -1 = manual)
    this.trailEmitter = scene.add
      .particles(0, 0, makeParticleDot(scene), {
        lifespan: 220,
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.5, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        tint: stats.palette.mid,
        frequency: -1,
      })
      .setDepth(3);
  }

  // ── Abstract interface ────────────────────────────────────────

  abstract onDeath(): void;
  abstract getProjectileTextureKey(): string;

  // Ghost trail padrão — subclasses podem sobrescrever para efeitos próprios
  protected onDashStart(_direction: number): void {
    const GHOST_COUNT = 4;
    const SPAWN_INTERVAL = 35;
    for (let i = 0; i < GHOST_COUNT; i++) {
      this.scene.time.delayedCall(i * SPAWN_INTERVAL, () => {
        if (!this.active) return;
        const ghost = this.scene.add.image(this.x, this.y, this.texture.key);
        ghost.setFlipX(this.flipX);
        ghost.setScale(this.scaleX, this.scaleY);
        ghost.setAlpha(0.35).setDepth(1);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 280,
          ease: 'Linear',
          onComplete: () => ghost.destroy(),
        });
      });
    }
  }

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
    if (this.isOnGround) {
      this.airDashUsed = false;
      this.lastGroundedTime = time;
    }

    this.handleCrouch(wasd);
    this.handleMovement(wasd);
    this.handleJump(wasd, spaceKey, time);
    this.handleDash(dashKey, time);
    this.handleFire(pointer, time);
    this.updateAnimation();
    this.cullingProjectiles();

    if (this.label) {
      this.label.setPosition(this.x, this.y - this.labelOffsetY);
    }
  }

  // ── Movement handlers ─────────────────────────────────────────

  setSlippery(slippery: boolean): void {
    this.isSlippery = slippery;
  }

  private handleMovement(wasd: WASDKeys): void {
    if (this.isDashing) return;
    if (this.isFrozen) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = this.stats.speed * this.slowMultiplier;

    if (this.isSlippery) {
      const accel = 15;
      const drag = 0.94;
      if (wasd.A.isDown) {
        body.setVelocityX(Math.max(-speed, body.velocity.x - accel));
        this.facingRight = false;
        this.setFlipX(true);
      } else if (wasd.D.isDown) {
        body.setVelocityX(Math.min(speed, body.velocity.x + accel));
        this.facingRight = true;
        this.setFlipX(false);
      } else {
        body.setVelocityX(body.velocity.x * drag);
        if (Math.abs(body.velocity.x) < 5) {
          body.setVelocityX(0);
        }
      }
    } else {
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
  }

  // Caminhada anda apenas no chão e em movimento; no ar/parado volta à pose
  // inicial (cada frame é uma textura separada — não há "frame 0" para setar).
  private updateAnimation(): void {
    if (!this.walkAnimKey) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const walking =
      this.isOnGround && !this.isDashing && !this.isFrozen && Math.abs(body.velocity.x) > 5;

    if (walking) {
      if (this.anims.currentAnim?.key !== this.walkAnimKey || !this.anims.isPlaying) {
        this.play(this.walkAnimKey, true);
      }
    } else if (this.anims.isPlaying) {
      this.stop();
      this.setTexture(this.idleTextureKey);
    }
  }

  private handleJump(wasd: WASDKeys, spaceKey: Phaser.Input.Keyboard.Key, time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Jump buffer: registra a intenção mesmo que ainda esteja no ar
    if (Phaser.Input.Keyboard.JustDown(wasd.W) || Phaser.Input.Keyboard.JustDown(spaceKey)) {
      this.lastJumpPressTime = time;
    }

    // Coyote time: pulo ainda vale logo após sair da borda
    const buffered = time - this.lastJumpPressTime <= CONSTANTS.JUMP_BUFFER_MS;
    const grounded = this.isOnGround || time - this.lastGroundedTime <= CONSTANTS.COYOTE_TIME_MS;

    if (buffered && grounded && !this.isCrouching && !this.isFrozen) {
      body.setVelocityY(this.stats.jumpVelocity);
      this.lastJumpPressTime = -Infinity; // consome o buffer
      this.lastGroundedTime = -Infinity;  // consome o coyote (evita pulo duplo)
      this.jumpCutApplied = false;
    }

    // Altura variável: soltar o botão durante a subida corta a velocidade
    if (
      !this.jumpCutApplied &&
      body.velocity.y < 0 &&
      !wasd.W.isDown &&
      !spaceKey.isDown
    ) {
      body.setVelocityY(body.velocity.y * CONSTANTS.JUMP_CUT_MULTIPLIER);
      this.jumpCutApplied = true;
    }
  }

  private handleDash(dashKey: Phaser.Input.Keyboard.Key, time: number): void {
    if (!Phaser.Input.Keyboard.JustDown(dashKey)) return;
    if (this.isFrozen) return;
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

  // Hitbox um pouco menor que o sprite (largura/altura), alinhada aos pés
  private static readonly HB_W = 0.74;
  private static readonly HB_H = 0.86;

  /** Aplica o corpo de física reduzido, centrado em X e alinhado aos pés. */
  protected applyBodySize(crouching: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const fw = this.frame.realWidth;
    const fh = this.frame.realHeight;
    const bw = fw * PlayerBase.HB_W;
    const bh = fh * (crouching ? 0.5 : PlayerBase.HB_H);
    body.setSize(bw, bh, false);
    body.setOffset((fw - bw) / 2, fh - bh); // base do corpo nos pés
  }

  private handleCrouch(wasd: WASDKeys): void {
    const shouldCrouch = wasd.S.isDown;
    if (shouldCrouch === this.isCrouching) return;

    this.isCrouching = shouldCrouch;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const feetY = body.bottom;

    this.setScale(1, this.isCrouching ? 0.5 : 1);
    this.applyBodySize(this.isCrouching);
    this.y = feetY - this.height / 2;
  }

  private handleFire(pointer: Phaser.Input.Pointer, time: number): void {
    if (!pointer.leftButtonDown()) return;
    if (time - this.lastFireTime < this.stats.fireCooldown) return;
    this.lastFireTime = time;

    // Snap para o múltiplo de 15° mais próximo do cursor — 12 ângulos por hemisfério (mais precisão)
    const raw = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
    const snapped = Math.round(raw / (Math.PI / 12)) * (Math.PI / 12);

    // Vira o personagem para o lado do cursor
    this.facingRight = Math.cos(snapped) >= 0;
    this.setFlipX(!this.facingRight);

    const key = this.getProjectileTextureKey();
    const p = this.projectilePool.get(this.x, this.y, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;

    p.setActive(true).setVisible(true);
    p.setBlendMode(Phaser.BlendModes.ADD); // textura tem glow assado
    p.setRotation(snapped);                // cápsula aponta na direção do tiro
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.reset(this.x, this.y);
    body.setAllowGravity(false);
    body.setVelocity(
      Math.cos(snapped) * this.stats.projectileSpeed,
      Math.sin(snapped) * this.stats.projectileSpeed,
    );

    this.spawnMuzzleFlash(snapped);
  }

  // Clarão no cano + fagulhas direcionais — o disparo ganha peso
  private spawnMuzzleFlash(angle: number): void {
    const key = `muzzle-${this.stats.palette.mid.toString(16)}`;
    makeGlowTexture(this.scene, key, this.stats.palette, 12);
    const mx = this.x + Math.cos(angle) * 18;
    const my = this.y + Math.sin(angle) * 18;
    const flash = this.scene.add
      .image(mx, my, key)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setRotation(angle)
      .setDepth(3)
      .setScale(0.6)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.4,
      alpha: 0,
      duration: 90,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Pequeno sopro de fagulhas no cano (reusa o emitter de rastro)
    this.trailEmitter.emitParticleAt(mx, my, 3);
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
        return;
      }
      // Rastro luminoso — o loop já visita todo projétil ativo por frame
      this.trailEmitter.emitParticleAt(p.x, p.y);
    });
  }

  // ── Projectile texture ────────────────────────────────────────

  private ensureProjectileTexture(): void {
    const key = this.getProjectileTextureKey();
    if (this.scene.textures.exists(key)) return;
    const w = this.stats.projectileWidth;
    const h = this.stats.projectileHeight;
    if (w / h >= 2) {
      // Formato de feixe → cápsula com glow assado
      makeGlowCapsule(this.scene, key, this.stats.palette, w + 8, h + 8);
    } else {
      // Formato de bolha/esfera → glow radial
      makeGlowTexture(this.scene, key, this.stats.palette, Math.ceil(Math.max(w, h) / 2) + 4);
    }
  }

  // ── Public API ────────────────────────────────────────────────

  getProjectileGroup(): Phaser.Physics.Arcade.Group {
    return this.projectilePool;
  }

  receiveDamage(amount: number): boolean {
    if (this.isInvincible || this.isDashing) return false;

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.isInvincible = true;

    // Feedback de impacto — shake curto e sutil
    this.scene.cameras.main.shake(120, 0.004);

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

  applySlowEffect(duration: number, multiplier: number = 0.4): void {
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
    this.slowMultiplier = multiplier;

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

  // Granadas de gelo da Sandy: imobiliza por completo (GDD: congela 1s)
  applyFreezeEffect(duration: number): void {
    if (this.freezeTimer) {
      this.freezeTimer.remove();
      this.freezeTimer = null;
    }

    this.isFrozen = true;
    this.setTint(0x81d4fa);
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);

    // Estilhaços de gelo se cravam ao redor do personagem
    const shards = this.scene.add
      .particles(this.x, this.y, makeParticleDot(this.scene), {
        speed: { min: 40, max: 140 },
        lifespan: { min: 250, max: 500 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.95, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        tint: 0xb2ebf2,
        emitting: false,
      })
      .setDepth(4);
    shards.explode(6, 0, 0);
    this.scene.time.delayedCall(550, () => shards.destroy());

    this.freezeTimer = this.scene.time.delayedCall(duration, () => {
      this.isFrozen = false;
      this.clearTint();
      this.freezeTimer = null;
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
    this.trailEmitter?.destroy();
    super.destroy(fromScene);
  }
}
