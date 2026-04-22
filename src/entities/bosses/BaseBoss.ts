import * as Phaser from 'phaser';
import { EventBus } from '../../core/EventBus';
import type { BossId } from '../../core/EventBus';

export interface BossConfig {
  bossId: BossId;
  hp: number;
  finalPhaseThreshold: number;
  m1Cooldown: number;
  m2Cooldown: number;
  finalPhaseSpeedMultiplier: number;
  finalPhaseDamageMultiplier: number;
  projectilePoolSize: number;
  projectileColor: number;
  projectileWidth: number;
  projectileHeight: number;
  projectileSpeed: number;
  projectileDamage: number;
}

export interface ProjectileData {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
}

export abstract class BaseBoss extends Phaser.GameObjects.Container {
  protected config: BossConfig;
  protected currentHp: number;
  protected isFinalPhase: boolean = false;
  protected lastM1Time: number = 0;
  protected lastM2Time: number = 0;
  protected isDefeated: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: BossConfig) {
    super(scene, x, y);
    this.config = config;
    this.currentHp = config.hp;
    scene.add.existing(this);
    this.buildVisual();
  }

  // ── Abstract interface ────────────────────────────────────────

  abstract getBossId(): BossId;
  abstract buildVisual(): void;
  abstract m1(time: number, targetX?: number, targetY?: number): ProjectileData[];
  abstract m2(time: number, targetX?: number, targetY?: number): ProjectileData[];
  abstract onFinalPhase(): void;

  // ── Concrete methods ──────────────────────────────────────────

  update(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    if (this.isDefeated) return [];
    this.checkFinalPhase();
    return [
      ...this.m1(time, targetX, targetY),
      ...this.m2(time, targetX, targetY),
    ];
  }

  receiveDamage(amount: number): void {
    if (this.isDefeated) return;
    this.currentHp = Math.max(0, this.currentHp - amount);
    this.onHit();
    this.checkFinalPhase();
    EventBus.emit('boss:damaged', {
      currentHp: this.currentHp,
      maxHp: this.config.hp,
      bossId: this.config.bossId,
    });
    if (this.currentHp <= 0) this.defeat();
  }

  getHpPercent(): number {
    return this.currentHp / this.config.hp;
  }

  isBossDefeated(): boolean {
    return this.isDefeated;
  }

  getConfig(): Readonly<BossConfig> {
    return this.config;
  }

  // ── Private ───────────────────────────────────────────────────

  private checkFinalPhase(): void {
    if (!this.isFinalPhase && this.getHpPercent() <= this.config.finalPhaseThreshold) {
      this.isFinalPhase = true;
      this.onFinalPhase();
      EventBus.emit('boss:final-phase', { bossId: this.config.bossId });
    }
  }

  private defeat(): void {
    this.isDefeated = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 600,
      onComplete: () => {
        EventBus.emit('boss:defeated', { bossId: this.config.bossId });
      },
    });
  }

  private onHit(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 60,
      yoyo: true,
    });
  }
}
