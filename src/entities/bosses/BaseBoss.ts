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
  textureKey?: string;   // default: textura padrão do boss na cena
  bounce?: boolean;      // quica nas paredes (notas do Lula na fase final)
  lifespanMs?: number;   // TTL para projéteis que não saem da tela
  gravity?: boolean;     // trajetória em arco (granadas de gelo da Sandy)
  effect?: 'freeze';     // efeito extra ao atingir o jogador
  trailTint?: number;    // cor do rastro de partículas (default: paleta do boss)
  rotation?: number;     // rotação visual do sprite (notas do Lula)
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
  abstract getHitBounds(): Phaser.Geom.Rectangle;

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
    // Punch de escala + jitter lateral — o golpe "pesa"
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.05,
      scaleY: this.scaleY * 1.05,
      duration: 40,
      yoyo: true,
    });
    this.scene.tweens.add({
      targets: this,
      x: this.x + Phaser.Math.Between(-3, 3),
      duration: 40,
      yoyo: true,
    });
  }
}
