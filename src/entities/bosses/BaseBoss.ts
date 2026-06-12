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

/** Posição onde o boss pode ficar: chão ou topo de uma plataforma. */
export interface BossPerch {
  y: number; // y do CENTRO do boss quando pousado nesta poleira
  xMin: number;
  xMax: number;
}

export abstract class BaseBoss extends Phaser.GameObjects.Container {
  protected config: BossConfig;
  protected currentHp: number;
  protected isFinalPhase: boolean = false;
  protected lastM1Time: number = 0;
  protected lastM2Time: number = 0;
  protected isDefeated: boolean = false;

  // ── Movimento terrestre (opt-in: buildVisual seta feetOffset > 0) ──
  protected feetOffset = 0;          // centro → pés (= displayHeight/2)
  private mvEnabled = false;
  private mvPerches: BossPerch[] = [];
  private mvCur = 0;
  private mvState: 'patrol' | 'hop' = 'patrol';
  private mvDir: 1 | -1 = -1;
  private mvSpeed = 62;              // px/s da patrulha
  private mvDecideAt = 0;
  private mvPrevTime = 0;
  private hopFromX = 0; private hopFromY = 0;
  private hopToX = 0;   private hopToY = 0;
  private hopArc = 0;   private hopStart = 0; private hopDur = 1; private hopTarget = 0;

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
    if (this.mvEnabled) this.updateMovement(time);
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
    // Jitter lateral só quando parado — em movimento brigaria com a patrulha
    if (!this.mvEnabled) {
      this.scene.tweens.add({
        targets: this,
        x: this.x + Phaser.Math.Between(-3, 3),
        duration: 40,
        yoyo: true,
      });
    }
  }

  // ── Movimento terrestre (patrulha + pulo nas plataformas) ─────

  /** Bosses terrestres setam feetOffset no buildVisual; os demais não. */
  usesGroundMovement(): boolean {
    return this.feetOffset > 0;
  }

  getFeetOffset(): number {
    return this.feetOffset;
  }

  /** A cena fornece as poleiras (chão + plataformas do lado direito). */
  configureGroundMovement(perches: BossPerch[], startX: number): void {
    if (perches.length === 0) return;
    this.mvPerches = perches;
    this.mvEnabled = true;
    this.mvCur = this.lowestPerch();
    const p = perches[this.mvCur];
    this.x = Phaser.Math.Clamp(startX, p.xMin, p.xMax);
    this.y = p.y;
    this.mvDir = Math.random() < 0.5 ? -1 : 1;
    this.mvState = 'patrol';
    this.mvDecideAt = 0;
  }

  private lowestPerch(): number {
    let idx = 0;
    this.mvPerches.forEach((p, i) => {
      if (p.y > this.mvPerches[idx].y) idx = i;
    });
    return idx;
  }

  private updateMovement(time: number): void {
    const dt = this.mvPrevTime ? Math.min((time - this.mvPrevTime) / 1000, 0.05) : 0;
    this.mvPrevTime = time;
    const speedMul = this.isFinalPhase ? 1.45 : 1;

    if (this.mvState === 'hop') {
      const t = Phaser.Math.Clamp((time - this.hopStart) / this.hopDur, 0, 1);
      this.x = Phaser.Math.Linear(this.hopFromX, this.hopToX, t);
      this.y = Phaser.Math.Linear(this.hopFromY, this.hopToY, t) - this.hopArc * Math.sin(Math.PI * t);
      if (t >= 1) {
        this.mvCur = this.hopTarget;
        const landed = this.mvPerches[this.mvCur];
        this.x = Phaser.Math.Clamp(this.hopToX, landed.xMin, landed.xMax);
        this.y = landed.y;
        this.mvDir = this.x <= (landed.xMin + landed.xMax) / 2 ? 1 : -1;
        this.mvState = 'patrol';
        this.mvDecideAt = time + Phaser.Math.Between(1500, 2900);
      }
      return;
    }

    // Patrulha horizontal + leve balanço vertical (nunca 100% estático)
    const p = this.mvPerches[this.mvCur];
    this.x += this.mvDir * this.mvSpeed * speedMul * dt;
    if (this.x <= p.xMin) { this.x = p.xMin; this.mvDir = 1; }
    else if (this.x >= p.xMax) { this.x = p.xMax; this.mvDir = -1; }
    this.y = p.y + Math.sin(time * 0.006) * 2.5;

    if (time >= this.mvDecideAt) this.decideNextMove(time);
  }

  private decideNextMove(time: number): void {
    const ground = this.lowestPerch();
    let target = this.mvCur;
    if (this.mvPerches.length > 1) {
      if (this.mvCur === ground) {
        target = Math.random() < 0.5 ? this.randomPerch(ground) : ground; // sobe às vezes
      } else {
        target = Math.random() < 0.7 ? ground : this.randomPerch(this.mvCur); // tende a descer
      }
    }
    if (target === this.mvCur) {
      this.mvDir = (Math.random() < 0.5 ? -1 : 1) as 1 | -1;
      this.mvDecideAt = time + Phaser.Math.Between(1300, 2600);
    } else {
      this.startHop(time, target);
    }
  }

  private randomPerch(exclude: number): number {
    if (this.mvPerches.length <= 1) return exclude;
    let i = exclude;
    while (i === exclude) i = Phaser.Math.Between(0, this.mvPerches.length - 1);
    return i;
  }

  private startHop(time: number, target: number): void {
    const to = this.mvPerches[target];
    this.hopFromX = this.x;
    this.hopFromY = this.y;
    this.hopToX = Phaser.Math.Clamp(this.x, to.xMin, to.xMax);
    this.hopToY = to.y;
    this.hopTarget = target;
    const dx = Math.abs(this.hopToX - this.hopFromX);
    const rise = Math.max(0, this.hopFromY - this.hopToY);
    this.hopArc = Math.max(75, rise + 55);          // sempre limpa o topo do destino
    this.hopDur = Phaser.Math.Clamp((dx + rise) * 1.5, 480, 1050);
    this.hopStart = time;
    this.mvState = 'hop';
  }
}
