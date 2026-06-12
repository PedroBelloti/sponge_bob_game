import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { EventBus } from '../../core/EventBus';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';
import { GameState } from '../../state/GameState';
import { ATTACK_PALETTES } from '../../config/theme';

// Posições-base (locais) de cada personagem dentro do container. Constantes de
// módulo (não campos de instância) porque buildVisual roda DENTRO do super() —
// antes dos inicializadores de campo da subclasse existirem.
const MM_HOME = { x: -56, y: 6 };  // Homem Sereia (esquerda)
const BB_HOME = { x: 62, y: -6 };  // Mexilhãozinho (direita)

const COMBATANT_HP = 2200; // por personagem — bem mais resistente

// Regiões (locais ao container) onde cada um vagueia. Homem Sereia ronda o
// centro-esquerda; Mexilhãozinho a direita — ambos sobem/descem bastante.
const MM_ROAM = { x0: -340, x1: -30, y0: -350, y1: -10 };
const BB_ROAM = { x0: -10, x1: 150, y0: -380, y1: -30 };

/** Um dos dois bosses do duo, com vida, ataque e movimento próprios. */
interface Combatant {
  key: 'mm' | 'bb';
  name: string;
  color: number;
  sprite: Phaser.GameObjects.Sprite;
  roam: { x0: number; x1: number; y0: number; y1: number };
  hp: number;
  maxHp: number;
  alive: boolean;
  enraged: boolean;
  lastFire: number;
  tx: number; // alvo local atual do vaguear
  ty: number;
  retargetAt: number;
}

export class FinalBoss extends BaseBoss {
  private isPrime = false;
  private isVulnerable = false;
  private attacksPaused = false; // os dois param de atirar no telegrafo do redemoinho

  private mm!: Combatant; // Homem Sereia — raio do cinturão (frequente)
  private bb!: Combatant; // Mexilhãozinho — bolhas teleguiadas (poucas)
  private wanderPrevTime = 0; // p/ dt do movimento

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const path = GameState.getInstance().getMoralPath();
    const isPrime = (path === 'egoista');

    const config: BossConfig = {
      bossId: 'final',
      hp: CONSTANTS.FINAL_BOSS_HP, // não usado p/ HP (cada combatente tem o seu)
      finalPhaseThreshold: 0, // sem "fase final" global — usamos enrage ao matar 1
      m1Cooldown: 1150,
      m2Cooldown: 12000, // Redemoinho disparado periodicamente pela cena
      finalPhaseSpeedMultiplier: 1.25,
      finalPhaseDamageMultiplier: 1.15,
      projectilePoolSize: 40,
      projectileColor: ATTACK_PALETTES.mermaidMan.mid,
      projectileWidth: 32,
      projectileHeight: 8,
      projectileSpeed: 500,
      projectileDamage: 1,
    };

    super(scene, x, y, config);
    this.isPrime = isPrime;

    const hpMul = isPrime ? CONSTANTS.PRIME_HP_MULTIPLIER : 1;
    this.mm.maxHp = this.mm.hp = COMBATANT_HP * hpMul;
    this.bb.maxHp = this.bb.hp = COMBATANT_HP * hpMul;
  }

  getBossId(): BossId {
    return 'final';
  }

  buildVisual(): void {
    const mmSprite = this.scene.add.sprite(MM_HOME.x, MM_HOME.y, 'mermaid-man-boss');
    mmSprite.setDisplaySize(108, 128);
    this.add(mmSprite);

    const bbSprite = this.scene.add.sprite(BB_HOME.x, BB_HOME.y, 'barnacle-boy-boss');
    bbSprite.setDisplaySize(95, 140);
    this.add(bbSprite);

    this.mm = {
      key: 'mm', name: 'HOMEM SEREIA', color: ATTACK_PALETTES.mermaidMan.mid,
      sprite: mmSprite, roam: MM_ROAM, hp: COMBATANT_HP, maxHp: COMBATANT_HP,
      alive: true, enraged: false, lastFire: 0,
      tx: MM_HOME.x, ty: MM_HOME.y, retargetAt: 0,
    };
    this.bb = {
      key: 'bb', name: 'MEXILHÃOZINHO', color: ATTACK_PALETTES.barnacleBoy.mid,
      sprite: bbSprite, roam: BB_ROAM, hp: COMBATANT_HP, maxHp: COMBATANT_HP,
      alive: true, enraged: false, lastFire: 0,
      tx: BB_HOME.x, ty: BB_HOME.y, retargetAt: 0,
    };
  }

  // ── Movimento independente: vagueiam pela arena por conta própria ──

  override update(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    if (!this.isDefeated && !this.scene.tweens.isTweening(this)) {
      const dt = this.wanderPrevTime ? Math.min((time - this.wanderPrevTime) / 1000, 0.05) : 0;
      this.wanderPrevTime = time;
      this.wanderCombatant(this.mm, dt, time);
      this.wanderCombatant(this.bb, dt, time);
    }
    return super.update(time, targetX, targetY);
  }

  private wanderCombatant(c: Combatant, dt: number, time: number): void {
    if (!c.alive) return; // morto fica parado/esmaecido
    const speed = c.enraged ? 185 : 115; // px/s (enraged se move bem mais)
    const dx = c.tx - c.sprite.x;
    const dy = c.ty - c.sprite.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) {
      const step = Math.min(d, speed * dt);
      c.sprite.x += (dx / d) * step;
      c.sprite.y += (dy / d) * step;
    }
    // chegou ao alvo (ou estourou o tempo) → novo destino aleatório na sua região
    if (time >= c.retargetAt || d <= 6) {
      c.tx = Phaser.Math.Between(c.roam.x0, c.roam.x1);
      c.ty = Phaser.Math.Between(c.roam.y0, c.roam.y1);
      c.retargetAt = time + Phaser.Math.Between(c.enraged ? 600 : 900, c.enraged ? 1300 : 2000);
    }
  }

  // ── Ataques (cada um com cadência própria) ────────────────────

  /** A cena pausa os ataques durante o telegrafo/uso do redemoinho. */
  setAttacksPaused(paused: boolean): void {
    this.attacksPaused = paused;
  }

  m1(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    if (this.attacksPaused || this.scene.tweens.isTweening(this)) return []; // parados no redemoinho

    const tx = targetX ?? this.x - 300;
    const ty = targetY ?? this.y - 50;
    const projectiles: ProjectileData[] = [];

    // HOMEM SEREIA: raio do cinturão (rápido, frequente, linha reta)
    if (this.mm.alive && time - this.mm.lastFire >= this.mmCooldown(this.mm.enraged)) {
      this.mm.lastFire = time;
      const ox = this.x + this.mm.sprite.x;
      const oy = this.y + this.mm.sprite.y;
      const a = Phaser.Math.Angle.Between(ox, oy, tx, ty);
      const speed = this.mmLaserSpeed(this.mm.enraged);
      projectiles.push({
        x: ox, y: oy,
        velocityX: Math.cos(a) * speed,
        velocityY: Math.sin(a) * speed,
        damage: 1,
        textureKey: 'mermaid-ray',
        trailTint: 0x66bb6a,
      });
    }

    // MEXILHÃOZINHO: poucas bolhas teleguiadas (seguem 3s, depois reto)
    if (this.bb.alive && time - this.bb.lastFire >= this.bbCooldown(this.bb.enraged)) {
      this.bb.lastFire = time;
      const count = this.bb.enraged ? 3 : 2;
      const ox = this.x + this.bb.sprite.x;
      const oy = this.y + this.bb.sprite.y;
      const a = Phaser.Math.Angle.Between(ox, oy, tx, ty);
      const cos = Math.cos(a), sin = Math.sin(a), gap = 42;
      const speed = this.bbBubbleSpeed(this.bb.enraged);
      for (let i = 0; i < count; i++) {
        projectiles.push({
          x: ox - cos * gap * i, y: oy - sin * gap * i,
          velocityX: cos * speed, velocityY: sin * speed,
          damage: 1,
          textureKey: 'barnacle-bubble',
          homingMs: 3000, // segue o player 3s; rumo tratado na PhaseScene
          trailTint: 0x64b5f6,
        });
      }
    }

    return projectiles;
  }

  m2(): ProjectileData[] {
    return []; // redemoinho é gerenciado pela cena
  }

  onFinalPhase(): void {
    // Sem fase final global — a escalada vem do enrage ao matar um dos dois.
  }

  private mmCooldown(enraged: boolean): number {
    let cd = 1150;
    if (this.isPrime) cd *= 0.75;
    if (enraged) cd *= 0.6;
    return cd;
  }

  private bbCooldown(enraged: boolean): number {
    let cd = 2600;
    if (this.isPrime) cd *= 0.8;
    if (enraged) cd *= 0.6;
    return cd;
  }

  private mmLaserSpeed(enraged: boolean): number {
    let s = 500; // um pouco mais lento que antes (era 580)
    if (this.isPrime) s *= CONSTANTS.PRIME_SPEED_MULTIPLIER;
    if (enraged) s *= 1.3;
    return s;
  }

  private bbBubbleSpeed(enraged: boolean): number {
    let s = 250;
    if (this.isPrime) s *= CONSTANTS.PRIME_SPEED_MULTIPLIER;
    if (enraged) s *= 1.25;
    return s;
  }

  // ── Dano: laser acerta UM; supremas (AoE) acertam ambos ───────

  setVulnerable(vulnerable: boolean): void {
    this.isVulnerable = vulnerable;
    if (vulnerable) {
      this.scene.tweens.add({ targets: this, alpha: 0.55, duration: 130, yoyo: true, repeat: 2 });
    }
  }

  getIsVulnerable(): boolean {
    return this.isVulnerable;
  }

  getIsPrime(): boolean {
    return this.isPrime;
  }

  /** Laser preciso → um combatente específico. */
  hitCombatant(key: 'mm' | 'bb', amount: number): void {
    const c = key === 'mm' ? this.mm : this.bb;
    if (c.alive) this.damageCombatant(c, amount);
  }

  /** Supremas (âncoras/onda) → dano em área nos dois vivos. */
  override receiveDamage(amount: number): void {
    if (this.mm.alive) this.damageCombatant(this.mm, amount);
    if (this.bb.alive) this.damageCombatant(this.bb, amount);
  }

  private damageCombatant(c: Combatant, amount: number): void {
    if (!c.alive) return;
    const dmg = this.isVulnerable ? amount * 2 : amount;
    c.hp = Math.max(0, c.hp - dmg);
    // Sem emit 'boss:damaged': a barra única padrão não se aplica — a FinalScene
    // desenha e atualiza duas barras lendo getBarStates() por frame.

    // Flash de dano no personagem atingido
    this.scene.tweens.add({ targets: c.sprite, alpha: 0.35, duration: 60, yoyo: true });

    if (c.hp <= 0) this.killCombatant(c);
  }

  private killCombatant(c: Combatant): void {
    c.alive = false;
    // Tomba e esmaece o derrotado
    this.scene.tweens.add({
      targets: c.sprite,
      alpha: 0.16,
      angle: c === this.mm ? -22 : 22,
      duration: 600,
      ease: 'Quad.easeIn',
    });

    const other = c === this.mm ? this.bb : this.mm;
    if (other.alive) {
      this.enrage(other);
    } else {
      this.defeatBoth();
    }
  }

  /** O sobrevivente fica mais forte e mais rápido. */
  private enrage(c: Combatant): void {
    c.enraged = true;
    c.sprite.setTint(0xffb3a0); // matiz de fúria
    this.scene.tweens.add({
      targets: c.sprite,
      scaleX: c.sprite.scaleX * 1.14,
      scaleY: c.sprite.scaleY * 1.14,
      duration: 220,
      yoyo: true,
      repeat: 1,
    });
  }

  private defeatBoth(): void {
    if (this.isDefeated) return;
    this.isDefeated = true;
    EventBus.emit('boss:defeated', { bossId: 'final' });
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 600 });
  }

  // ── Estado exposto p/ a cena (alvos de laser + barras de HP) ──

  /** Caixas de acerto dos combatentes vivos, p/ o laser preciso. */
  getAliveTargets(): { key: 'mm' | 'bb'; rect: Phaser.Geom.Rectangle }[] {
    const out: { key: 'mm' | 'bb'; rect: Phaser.Geom.Rectangle }[] = [];
    for (const c of [this.mm, this.bb]) {
      if (c.alive) out.push({ key: c.key, rect: this.combatantBox(c) });
    }
    return out;
  }

  /** Dados das duas barras (ordem fixa: Homem Sereia, Mexilhãozinho). */
  getBarStates(): { key: 'mm' | 'bb'; name: string; color: number; hpPct: number; alive: boolean }[] {
    return [this.mm, this.bb].map((c) => ({
      key: c.key, name: c.name, color: c.color,
      hpPct: c.maxHp > 0 ? c.hp / c.maxHp : 0, alive: c.alive,
    }));
  }

  private combatantBox(c: Combatant): Phaser.Geom.Rectangle {
    const cx = this.x + c.sprite.x;
    const cy = this.y + c.sprite.y;
    const hw = c.sprite.displayWidth * 0.42;
    const hh = c.sprite.displayHeight * 0.45;
    return new Phaser.Geom.Rectangle(cx - hw, cy - hh, hw * 2, hh * 2);
  }

  /** União das caixas vivas (usada pela Onda de Surf, que é AoE). */
  getHitBounds(): Phaser.Geom.Rectangle {
    const alive = [this.mm, this.bb].filter((c) => c.alive);
    if (alive.length === 0) return new Phaser.Geom.Rectangle(this.x, this.y, 0, 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of alive) {
      const b = this.combatantBox(c);
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
    }
    return new Phaser.Geom.Rectangle(x0, y0, x1 - x0, y1 - y0);
  }
}
