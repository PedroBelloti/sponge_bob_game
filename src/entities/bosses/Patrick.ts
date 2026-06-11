import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';

// GDD: a escolha de diálogo molda o comportamento do boss.
// A — "isso aí não é seu"     → desorientado: lento e imprevisível
// B — "brincar de pega-pega?" → animado: cadência alta, padrões legíveis
export type PatrickMood = 'desorientado' | 'animado' | null;

const TELEGRAPH_M1_MS = 350;
const TELEGRAPH_M2_MS = 500;

const MOOD_COOLDOWN: Record<Exclude<PatrickMood, null>, number> = {
  desorientado: 1.35,
  animado: 0.6,
};

export class Patrick extends BaseBoss {
  private isDoingM2: boolean = false;
  private mood: PatrickMood = null;

  // Telegraph: instante em que o ataque pendente dispara (null = sem pendência)
  private pendingM1At: number | null = null;
  private pendingM2At: number | null = null;

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

  // ── Mood (escolha de diálogo) ─────────────────────────────────

  setMood(mood: PatrickMood): void {
    this.mood = mood;
  }

  private moodCooldown(base: number): number {
    return this.mood ? base * MOOD_COOLDOWN[this.mood] : base;
  }

  // Desorientado: ângulo e velocidade ganham variação imprevisível
  private moodJitterAngle(rad: number): number {
    if (this.mood !== 'desorientado') return rad;
    return rad + Phaser.Math.DegToRad(Phaser.Math.Between(-12, 12));
  }

  private moodJitterSpeed(speed: number): number {
    if (this.mood !== 'desorientado') return speed;
    return speed * Phaser.Math.FloatBetween(0.8, 1.2);
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
    if (this.isDoingM2) return [];

    // Fase 1 do ataque: cooldown vencido → telegraph (pulso) e agenda o disparo
    if (this.pendingM1At === null) {
      if (time - this.lastM1Time < this.moodCooldown(this.config.m1Cooldown)) return [];
      this.pendingM1At = time + TELEGRAPH_M1_MS;
      this.telegraphPulse(1.08, TELEGRAPH_M1_MS);
      return [];
    }

    // Fase 2: aguarda o fim do telegraph e dispara
    if (time < this.pendingM1At) return [];
    this.pendingM1At = null;
    this.lastM1Time = time;

    const baseSpeed = this.isFinalPhase
      ? this.config.projectileSpeed * this.config.finalPhaseSpeedMultiplier
      : this.config.projectileSpeed;
    const damage = this.config.projectileDamage;
    const goLeft = (targetX ?? 0) < this.x;
    const dir = goLeft ? -1 : 1;

    const angles = this.isFinalPhase ? [-10, 0, 10] : [0];
    return angles.map((deg) => {
      const rad = this.moodJitterAngle(Phaser.Math.DegToRad(deg));
      const speed = this.moodJitterSpeed(baseSpeed);
      return {
        x: this.x,
        y: this.y,
        velocityX: Math.cos(rad) * speed * dir,
        velocityY: Math.sin(rad) * speed,
        damage,
      };
    });
  }

  m2(time: number): ProjectileData[] {
    if (this.isDoingM2) return [];

    // Telegraph maior: Patrick "infla" antes da barrigada
    if (this.pendingM2At === null) {
      if (time - this.lastM2Time < this.moodCooldown(this.config.m2Cooldown)) return [];
      this.pendingM2At = time + TELEGRAPH_M2_MS;
      this.telegraphPulse(1.18, TELEGRAPH_M2_MS);
      return [];
    }

    if (time < this.pendingM2At) return [];
    this.pendingM2At = null;
    this.lastM2Time = time;
    this.isDoingM2 = true;
    this.pendingM1At = null; // M1 telegrafado antes da barrigada não dispara "do nada" depois

    const damage = Math.round(
      this.config.projectileDamage *
      (this.isFinalPhase ? this.config.finalPhaseDamageMultiplier : 1),
    );
    const waveSpeed = this.moodJitterSpeed(
      400 * (this.isFinalPhase ? this.config.finalPhaseSpeedMultiplier : 1),
    );
    const waveY = this.y + 55; // ground level (feet of Patrick)

    // Impacto da barrigada
    this.scene.cameras.main.shake(150, 0.006);

    // Janela de punição clara: 2s caído antes de se levantar (GDD)
    this.scene.time.delayedCall(2000, () => {
      this.isDoingM2 = false;
    });

    return [
      { x: this.x, y: waveY, velocityX: -waveSpeed, velocityY: 0, damage },
      { x: this.x, y: waveY, velocityX: +waveSpeed, velocityY: 0, damage },
    ];
  }

  onFinalPhase(): void {
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

  // ── Telegraph visual ──────────────────────────────────────────

  private telegraphPulse(scaleTo: number, duration: number): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: scaleTo,
      scaleY: scaleTo,
      duration: duration / 2,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }
}
