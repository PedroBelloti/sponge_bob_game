import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';

// GDD: a escolha de diálogo molda o comportamento do boss.
// A — "você também sabe como é não pertencer"  → desestabilizado:
//      ataques mais fracos, com momentos de fúria explosiva
// B — "sua arte é medíocre"                    → furioso:
//      mais rápido, sem pausas
export type LulaMood = 'desestabilizado' | 'furioso' | null;

const TELEGRAPH_M1_MS = 300;
const FURY_INTERVAL_MS = 9000;
const FURY_DURATION_MS = 2500;
const FURY_COOLDOWN_MS = 700; // cadência durante a fúria

export class LulaMolusco extends BaseBoss {
  private mood: LulaMood = null;
  private pendingM1At: number | null = null;

  // Holofote: enquanto ativo, Lula mira com precisão aumentada (GDD)
  private isPrecise: boolean = false;

  // Ciclo de fúria do mood desestabilizado
  private furyUntil: number = 0;
  private nextFuryAt: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const config: BossConfig = {
      bossId: 'lula',
      hp: CONSTANTS.LULA_HP,
      finalPhaseThreshold: CONSTANTS.LULA_FINAL_PHASE,
      m1Cooldown: 2300,
      m2Cooldown: 999_999, // estátuas são geridas pela cena via tryRequestStatues
      finalPhaseSpeedMultiplier: 1.2,
      finalPhaseDamageMultiplier: 1.0,
      projectilePoolSize: 30,
      projectileColor: 0xb388ff, // violeta elétrico da paleta lula do tema
      projectileWidth: 14,
      projectileHeight: 14,
      projectileSpeed: CONSTANTS.LULA_NOTE_SPEED,
      projectileDamage: CONSTANTS.LULA_NOTE_DAMAGE,
    };
    super(scene, x, y, config);
  }

  // ── Mood / holofote ───────────────────────────────────────────

  setMood(mood: LulaMood): void {
    this.mood = mood;
  }

  setPrecise(precise: boolean): void {
    this.isPrecise = precise;
  }

  private inFury(time: number): boolean {
    if (this.mood !== 'desestabilizado') return false;
    // Primeiro frame da luta: agenda a primeira fúria em vez de estourar já
    if (this.nextFuryAt === 0) {
      this.nextFuryAt = time + FURY_INTERVAL_MS / 2;
      return false;
    }
    if (time >= this.nextFuryAt) {
      this.furyUntil = time + FURY_DURATION_MS;
      this.nextFuryAt = time + FURY_INTERVAL_MS;
      // Estoura em fúria: tremor curto no corpo
      this.scene.tweens.add({
        targets: this, angle: 4, duration: 60, yoyo: true, repeat: 5,
      });
    }
    return time < this.furyUntil;
  }

  private currentM1Cooldown(time: number): number {
    if (this.inFury(time)) return FURY_COOLDOWN_MS;          // explosão de fúria
    if (this.mood === 'desestabilizado') return this.config.m1Cooldown * 1.4; // mais fraco
    if (this.mood === 'furioso') return this.config.m1Cooldown * 0.55;        // sem pausas
    return this.config.m1Cooldown;
  }

  // ── BaseBoss impl ─────────────────────────────────────────────

  getBossId(): BossId {
    return 'lula';
  }

  buildVisual(): void {
    const g = this.scene.add.graphics();

    // Cabeça/corpo
    g.fillStyle(0x80cbc4, 1);
    g.fillRoundedRect(-45, -65, 90, 95, 18);

    // Camisa marrom
    g.fillStyle(0x8d6e63, 1);
    g.fillRect(-45, 12, 90, 53);

    // Nariz caído
    g.fillStyle(0x6fb3aa, 1);
    g.fillEllipse(0, -8, 22, 42);

    // Olhos entediados
    g.fillStyle(0xfffde7, 1);
    g.fillEllipse(-16, -42, 22, 16);
    g.fillEllipse(16, -42, 22, 16);
    g.fillStyle(0x4e342e, 1);
    g.fillCircle(-16, -40, 4);
    g.fillCircle(16, -40, 4);

    this.add(g);

    const label = this.scene.add
      .text(0, -88, 'LULA MOLUSCO', {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: '12px',
        color: '#B2DFDB',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(label);
  }

  m1(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    // Telegraph: Lula ergue o clarinete (pulso) antes da rajada
    if (this.pendingM1At === null) {
      if (time - this.lastM1Time < this.currentM1Cooldown(time)) return [];
      this.pendingM1At = time + TELEGRAPH_M1_MS;
      this.scene.tweens.add({
        targets: this, scaleX: 1.06, scaleY: 1.06,
        duration: TELEGRAPH_M1_MS / 2, yoyo: true, ease: 'Sine.easeInOut',
      });
      return [];
    }

    if (time < this.pendingM1At) return [];
    this.pendingM1At = null;
    this.lastM1Time = time;

    const muzzleX = this.x - 50;
    const muzzleY = this.y - 20;
    const tx = targetX ?? muzzleX - 1;
    const ty = targetY ?? muzzleY;

    // Sob o holofote a mira é exata; fora dele, dispersa (GDD)
    let angle = Phaser.Math.Angle.Between(muzzleX, muzzleY, tx, ty);
    if (!this.isPrecise) {
      angle += Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-9, 9));
    }

    const speed = this.config.projectileSpeed *
      (this.isFinalPhase ? this.config.finalPhaseSpeedMultiplier : 1);

    // Desestabilizado fora da fúria: rajada mais fraca (3 notas em vez de 5)
    const count = this.mood === 'desestabilizado' && !this.inFury(time)
      ? 3
      : CONSTANTS.LULA_NOTES_PER_BURST;

    // Notas enfileiradas atrás do bocal — viajam como uma linha (GDD)
    const gap = 30;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return Array.from({ length: count }, (_, i) => ({
      x: muzzleX - cos * gap * i,
      y: muzzleY - sin * gap * i,
      velocityX: cos * speed,
      velocityY: sin * speed,
      damage: this.config.projectileDamage,
      // GDD fase final: notas passam a quicar nas paredes
      bounce: this.isFinalPhase,
      lifespanMs: this.isFinalPhase ? 3500 : undefined,
      // Cada nota nasce com uma inclinação própria — a linha parece "tocada"
      rotation: Phaser.Math.FloatBetween(-0.4, 0.4),
    }));
  }

  m2(_time: number): ProjectileData[] {
    return []; // estátuas explosivas são entidades da cena, não projéteis
  }

  /**
   * Estátua Explosiva (M2) — a cena pergunta a cada frame; quando o cooldown
   * vence, retorna quantas estátuas invocar (2 na fase final — GDD).
   */
  tryRequestStatues(time: number): number {
    if (this.isDefeated) return 0;
    // Primeiro frame da luta: arma o cooldown em vez de invocar de cara
    if (this.lastM2Time === 0) {
      this.lastM2Time = time - CONSTANTS.LULA_STATUE_COOLDOWN_MS / 2;
      return 0;
    }
    if (time - this.lastM2Time < CONSTANTS.LULA_STATUE_COOLDOWN_MS) return 0;
    this.lastM2Time = time;
    return this.isFinalPhase ? 2 : 1;
  }

  onFinalPhase(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 200,
      yoyo: true,
      repeat: 1,
    });
  }

  getHitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 45, this.y - 65, 90, 130);
  }
}
