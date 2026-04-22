import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';

const EYE_OFFSET_Y = -130;

export class RoboPlankton extends BaseBoss {
  static readonly MAX_HP = CONSTANTS.PLANKTON_PROLOGO_HP;
  private static readonly MIN_HP = 1;

  constructor(scene: Phaser.Scene, groundY: number) {
    const config: BossConfig = {
      bossId: 'prologo',
      hp: CONSTANTS.PLANKTON_PROLOGO_HP,
      finalPhaseThreshold: 0.5,
      m1Cooldown: 2000,
      m2Cooldown: 999_999, // disabled — final phase handled inside m1
      finalPhaseSpeedMultiplier: 1.0,
      finalPhaseDamageMultiplier: 1.0,
      projectilePoolSize: 30,
      projectileColor: 0xff6f00,
      projectileWidth: 20,
      projectileHeight: 20,
      projectileSpeed: CONSTANTS.PROLOGO_ROBO_PROJECTILE_SPEED,
      projectileDamage: CONSTANTS.ROBO_PROLOGO_PROJECTILE_DAMAGE,
    };
    super(scene, CONSTANTS.GAME_WIDTH - 180, groundY, config);
    this.startAnimations(groundY);
  }

  // ── BaseBoss impl ─────────────────────────────────────────────

  getBossId(): BossId {
    return 'prologo';
  }

  buildVisual(): void {
    const g = this.scene.add.graphics();

    // Arms (behind body)
    g.fillStyle(0x1b5e20, 1);
    g.fillRect(-80, -150, 20, 60);
    g.fillRect(60, -150, 20, 60);

    // Base / legs
    g.fillRect(-70, -30, 140, 30);

    // Body
    g.fillStyle(0x2e7d32, 1);
    g.fillRect(-60, -190, 120, 160);

    // Eye
    g.fillStyle(0xff1744, 1);
    g.fillCircle(0, EYE_OFFSET_Y, 30);

    // Pupil
    g.fillStyle(0x000000, 1);
    g.fillCircle(0, EYE_OFFSET_Y, 12);

    this.add(g);
  }

  // Never defeated — clamp HP at MIN_HP so bar looks almost empty
  override receiveDamage(amount: number): void {
    const clamped = Math.min(amount, this.currentHp - RoboPlankton.MIN_HP);
    if (clamped <= 0) return;
    super.receiveDamage(clamped);
  }

  m1(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    if (time - this.lastM1Time < this.config.m1Cooldown) return [];
    this.lastM1Time = time;

    const eyeX = this.x;
    const eyeY = this.y + EYE_OFFSET_Y;
    const tx = targetX ?? eyeX - 1;
    const ty = targetY ?? eyeY;

    return this.isFinalPhase
      ? this.buildSpread(eyeX, eyeY, tx, ty)
      : this.buildSingle(eyeX, eyeY, tx, ty);
  }

  m2(_time: number): ProjectileData[] {
    return []; // handled internally via m1 delegation
  }

  onFinalPhase(): void {
    console.log('[RoboPlankton] fase final — 3 projéteis em spread');
  }

  // ── Helpers ───────────────────────────────────────────────────

  getHitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 80, this.y - 190, 160, 195);
  }

  private buildSingle(ex: number, ey: number, tx: number, ty: number): ProjectileData[] {
    const angle = Phaser.Math.Angle.Between(ex, ey, tx, ty);
    return [{
      x: ex, y: ey,
      velocityX: Math.cos(angle) * this.config.projectileSpeed,
      velocityY: Math.sin(angle) * this.config.projectileSpeed,
      damage: this.config.projectileDamage,
    }];
  }

  private buildSpread(ex: number, ey: number, tx: number, ty: number): ProjectileData[] {
    const base = Phaser.Math.Angle.Between(ex, ey, tx, ty);
    const spread = Phaser.Math.DegToRad(15);
    return [-1, 0, 1].map((i) => {
      const angle = base + spread * i;
      return {
        x: ex, y: ey,
        velocityX: Math.cos(angle) * this.config.projectileSpeed,
        velocityY: Math.sin(angle) * this.config.projectileSpeed,
        damage: this.config.projectileDamage,
      };
    });
  }

  private startAnimations(groundY: number): void {
    this.scene.tweens.add({
      targets: this,
      y: groundY - 15,
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this.setAngle(-3);
    this.scene.tweens.add({
      targets: this,
      angle: 3,
      duration: 2200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }
}
