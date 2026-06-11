import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';
import { GameState } from '../../state/GameState';
import { ATTACK_PALETTES } from '../../config/theme';

export class FinalBoss extends BaseBoss {
  private isPrime: boolean = false;
  private isVulnerable: boolean = false;
  private speedMultiplier: number = 1.0;
  private damageMultiplier: number = 1.0;



  constructor(scene: Phaser.Scene, x: number, y: number) {
    const path = GameState.getInstance().getMoralPath();
    const isPrime = (path === 'egoista');
    
    const baseHp = CONSTANTS.FINAL_BOSS_HP;
    const hp = isPrime ? baseHp * CONSTANTS.PRIME_HP_MULTIPLIER : baseHp;
    const speedMult = isPrime ? CONSTANTS.PRIME_SPEED_MULTIPLIER : 1.0;
    const dmgMult = isPrime ? CONSTANTS.PRIME_DAMAGE_MULTIPLIER : 1.0;

    const config: BossConfig = {
      bossId: 'final',
      hp: hp,
      finalPhaseThreshold: CONSTANTS.FINAL_BOSS_FINAL_PHASE,
      m1Cooldown: 1800,
      m2Cooldown: 12000, // Whirlpool triggered periodically
      finalPhaseSpeedMultiplier: 1.25,
      finalPhaseDamageMultiplier: 1.15,
      projectilePoolSize: 40,
      projectileColor: 0x66bb6a, // MM mid color
      projectileWidth: 32,
      projectileHeight: 8,
      projectileSpeed: 500,
      projectileDamage: 1,
    };

    super(scene, x, y, config);
    this.isPrime = isPrime;
    this.speedMultiplier = speedMult;
    this.damageMultiplier = dmgMult;
  }

  setVulnerable(vulnerable: boolean): void {
    this.isVulnerable = vulnerable;
    if (vulnerable) {
      // Scale down and rotate slightly to show fatigue
      this.scene.tweens.add({
        targets: this,
        scaleX: 0.9,
        scaleY: 0.9,
        angle: 15,
        duration: 200,
      });
      // Flash gold to show vulnerability
      this.scene.tweens.add({
        targets: this,
        alpha: 0.5,
        duration: 150,
        yoyo: true,
        repeat: 2,
      });
    } else {
      // Revert visual
      this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        duration: 200,
      });
    }
  }

  getIsVulnerable(): boolean {
    return this.isVulnerable;
  }

  getIsPrime(): boolean {
    return this.isPrime;
  }

  private currentM1Cooldown(): number {
    let cd = this.config.m1Cooldown;
    if (this.isPrime) cd *= 0.75; // Fast pressure in Prime mode
    if (this.isFinalPhase) cd *= 0.7;
    return cd;
  }

  private mmLaserSpeed(): number {
    let s = 580;
    if (this.isPrime) s *= this.speedMultiplier;
    if (this.isFinalPhase) s *= this.config.finalPhaseSpeedMultiplier;
    return s;
  }

  private bbBubbleSpeed(): number {
    let s = 250;
    if (this.isPrime) s *= this.speedMultiplier;
    if (this.isFinalPhase) s *= this.config.finalPhaseSpeedMultiplier;
    return s;
  }

  // ── BaseBoss impl ─────────────────────────────────────────────

  getBossId(): BossId {
    return 'final';
  }

  buildVisual(): void {
    const g = this.scene.add.graphics();

    // ── HOMEM SEREIA (Mermaid Man) — Esquerda do Container ──
    // Corpo / Roupa laranja
    g.fillStyle(0xffa726, 1);
    g.fillCircle(-40, -40, 22);
    // Luvas e sutiã de concha verde
    g.fillStyle(0x2e7d32, 1);
    g.fillCircle(-48, -42, 6);
    g.fillCircle(-32, -42, 6);
    g.fillStyle(0x2e7d32, 1); // Cinto verde
    g.fillRect(-56, -26, 32, 6);
    // Letra M no cinto
    g.fillStyle(0xffffd54f, 1);
    g.fillRect(-42, -26, 4, 6);
    // Rosto rosado
    g.fillStyle(0xffcc80, 1);
    g.fillCircle(-40, -66, 14);
    // Olhos e máscara roxa
    g.fillStyle(0xba68c8, 1);
    g.fillTriangle(-40, -66, -46, -72, -34, -72);
    g.fillStyle(0x000000, 1);
    g.fillCircle(-44, -68, 1.5);
    g.fillCircle(-36, -68, 1.5);
    // Pernas (meia calça verde e chinelos)
    g.fillStyle(0x4caf50, 1);
    g.fillRect(-48, -18, 6, 18);
    g.fillRect(-38, -18, 6, 18);
    // Cabelo branco
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-52, -72, 6);
    g.fillCircle(-28, -72, 6);
    g.fillRect(-52, -76, 24, 6);

    // ── MEXILHÃOZINHO (Barnacle Boy) — Direita do Container ──
    // Corpo / Roupa vermelha
    g.fillStyle(0xe53935, 1);
    g.fillRect(26, -52, 28, 34);
    // Calção preto
    g.fillStyle(0x212121, 1);
    g.fillRect(26, -18, 28, 8);
    // Pernas azuis/cinza
    g.fillStyle(0x1e88e5, 1);
    g.fillRect(30, -10, 5, 10);
    g.fillRect(45, -10, 5, 10);
    // Rosto
    g.fillStyle(0xffcc80, 1);
    g.fillCircle(40, -70, 12);
    // Narigão saliente
    g.fillStyle(0xffb74d, 1);
    g.fillEllipse(36, -68, 8, 14);
    // Máscara azul nos olhos
    g.fillStyle(0x1e88e5, 1);
    g.fillRect(32, -74, 16, 4);
    g.fillStyle(0x000000, 1);
    g.fillCircle(36, -72, 1.5);
    g.fillCircle(44, -72, 1.5);
    // Lenço azul no pescoço
    g.fillStyle(0x1e88e5, 1);
    g.fillTriangle(28, -52, 52, -52, 40, -44);
    // Boné branco de marinheiro
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(30, -84, 20, 6, 2);

    this.add(g);

    const label = this.scene.add
      .text(0, -104, 'HOMEM SEREIA E MEXILHÃOZINHO', {
        fontFamily: '"Russo One", Impact, sans-serif',
        fontSize: '11px',
        color: '#81c784',
        shadow: { color: '#000000', fill: true, offsetX: 1, offsetY: 1, blur: 2 },
      })
      .setOrigin(0.5);
    this.add(label);
  }

  override receiveDamage(amount: number): void {
    // Se vulnerável, recebe dano crítico dobrado! (GDD)
    const actualAmount = this.isVulnerable ? amount * 2 : amount;
    super.receiveDamage(actualAmount);
  }

  m1(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    if (time - this.lastM1Time < this.currentM1Cooldown()) return [];
    this.lastM1Time = time;

    const tx = targetX ?? this.x - 300;
    const ty = targetY ?? this.y - 50;

    // Se estiver no redemoinho (M2), não ataca M1
    if (this.scene.tweens.isTweening(this)) return [];

    const projectiles: ProjectileData[] = [];

    // ── Ataque Homem Sereia: Lasers rápidos em linha reta (M1) ──
    const mmX = this.x - 40;
    const mmY = this.y - 40;
    const angleMM = Phaser.Math.Angle.Between(mmX, mmY, tx, ty);
    
    projectiles.push({
      x: mmX,
      y: mmY,
      velocityX: Math.cos(angleMM) * this.mmLaserSpeed(),
      velocityY: Math.sin(angleMM) * this.mmLaserSpeed(),
      damage: 1,
      textureKey: 'mermaid-ray',
      trailTint: 0x66bb6a,
    });

    // ── Ataque Mexilhãozinho: Bolhas lentas guiadas (M1) ──
    // Na Forma Prime final, dispara 5 bolhas. Na Forma Aposentada ou normal, 3 bolhas.
    const bubbleCount = (this.isPrime && this.isFinalPhase) ? 5 : 3;
    const bbX = this.x + 40;
    const bbY = this.y - 50;

    // Se na Forma Prime, dispara ambos simultaneamente (GDD)
    // Se na Forma Aposentada normal, pode alternar ou disparar com delay
    const fireBubbles = () => {
      const angleBB = Phaser.Math.Angle.Between(bbX, bbY, tx, ty);
      const gap = 45;
      const cos = Math.cos(angleBB);
      const sin = Math.sin(angleBB);

      for (let i = 0; i < bubbleCount; i++) {
        projectiles.push({
          x: bbX - cos * gap * i,
          y: bbY - sin * gap * i,
          velocityX: cos * this.bbBubbleSpeed(),
          velocityY: sin * this.bbBubbleSpeed(),
          damage: 1,
          textureKey: 'barnacle-bubble', // Trajetória guiada tratada na PhaseScene
          trailTint: 0x64b5f6,
        });
      }
    };

    if (this.isPrime || Phaser.Math.Between(0, 10) > 3) {
      fireBubbles();
    }

    return projectiles;
  }

  m2(_time: number): ProjectileData[] {
    // Redemoinho duplo é disparado de forma independente gerenciado pela cena
    return [];
  }

  onFinalPhase(): void {
    if (this.isPrime) {
      // Forma Prime: Aumento de stats permanente na fase final (GDD)
      this.speedMultiplier *= this.config.finalPhaseSpeedMultiplier;
      this.damageMultiplier *= this.config.finalPhaseDamageMultiplier;

      this.scene.tweens.add({
        targets: this,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 300,
        yoyo: true,
        repeat: 1,
      });
    } else {
      // Forma Aposentada: Esforço final por 20 segundos (GDD)
      const originalSpeedMult = this.speedMultiplier;
      this.speedMultiplier *= 1.35;

      // Brilho dourado temporário de esforço final
      this.enableFilters();
      this.filters?.internal.addGlow(0xffd400, 3);

      this.scene.time.delayedCall(20000, () => {
        this.speedMultiplier = originalSpeedMult;
        // Desligar o brilho temporário
        if (!this.isDefeated) {
          (this as any).filters = null;
          this.enableFilters();
          this.filters?.internal.addGlow(ATTACK_PALETTES.mermaidMan.mid, 4);
        }
      });
    }
  }

  getHitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 70, this.y - 84, 140, 84);
  }
}
