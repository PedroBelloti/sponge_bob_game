import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';

export class Patrick extends BaseBoss {
  private isDoingM2: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const config: BossConfig = {
      bossId: 'patrick',
      hp: CONSTANTS.PATRICK_HP,
      finalPhaseThreshold: CONSTANTS.PATRICK_FINAL_PHASE,
      m1Cooldown: 2800,
      m2Cooldown: 5000,
      finalPhaseSpeedMultiplier: 1.3,
      finalPhaseDamageMultiplier: 1.2,
      projectilePoolSize: 15,
      projectileColor: 0xffb74d,
      projectileWidth: 24,
      projectileHeight: 24,
      projectileSpeed: 380,
      projectileDamage: CONSTANTS.PATRICK_PROJECTILE_DAMAGE,
    };
    super(scene, x, y, config);
  }

  // ── BaseBoss impl ─────────────────────────────────────────────

  getBossId(): BossId {
    return 'patrick';
  }

  buildVisual(): void {
    const g = this.scene.add.graphics();

    // Corpo
    g.fillStyle(0xff8a65, 1);
    g.fillRect(-50, -60, 100, 120);

    // Barriga
    g.fillStyle(0xffccbc, 1);
    g.fillEllipse(0, 10, 60, 70);

    this.add(g);

    const label = this.scene.add
      .text(0, -80, 'PATRICK', { fontSize: '14px', color: '#333333', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add(label);
  }

  m1(time: number, targetX?: number): ProjectileData[] {
    if (time - this.lastM1Time < this.config.m1Cooldown) return [];
    if (this.isDoingM2) return [];
    this.lastM1Time = time;

    const speed = this.isFinalPhase
      ? this.config.projectileSpeed * this.config.finalPhaseSpeedMultiplier
      : this.config.projectileSpeed;
    const damage = this.config.projectileDamage;
    const goLeft = (targetX ?? 0) < this.x;

    if (this.isFinalPhase) {
      // 3 pedras: -10°, 0°, +10°
      return [-10, 0, 10].map((deg) => {
        const rad = Phaser.Math.DegToRad(deg);
        const dir = goLeft ? -1 : 1;
        return {
          x: this.x,
          y: this.y,
          velocityX: Math.cos(rad) * speed * dir,
          velocityY: Math.sin(rad) * speed,
          damage,
        };
      });
    }

    return [{
      x: this.x,
      y: this.y,
      velocityX: goLeft ? -speed : speed,
      velocityY: 0,
      damage,
    }];
  }

  m2(time: number): ProjectileData[] {
    if (time - this.lastM2Time < this.config.m2Cooldown) return [];
    if (this.isDoingM2) return [];
    this.lastM2Time = time;
    this.isDoingM2 = true;

    const damage = Math.round(
      this.config.projectileDamage *
      (this.isFinalPhase ? this.config.finalPhaseDamageMultiplier : 1),
    );
    const waveSpeed = 400 * (this.isFinalPhase ? this.config.finalPhaseSpeedMultiplier : 1);
    const waveY = this.y + 55; // ground level (feet of Patrick)

    this.scene.time.delayedCall(2000, () => {
      this.isDoingM2 = false;
    });

    return [
      { x: this.x, y: waveY, velocityX: -waveSpeed, velocityY: 0, damage },
      { x: this.x, y: waveY, velocityX: +waveSpeed, velocityY: 0, damage },
    ];
  }

  onFinalPhase(): void {
    console.log('[Patrick] FASE FINAL');
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 200,
      yoyo: true,
      repeat: 1,
    });
  }

  getHitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 50, this.y - 60, 100, 120);
  }
}
