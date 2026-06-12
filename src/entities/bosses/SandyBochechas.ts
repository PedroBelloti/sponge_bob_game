import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { EventBus } from '../../core/EventBus';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';

// GDD: a escolha de diálogo molda o comportamento do boss.
// A — "a única que me entende intelectualmente" → respeitosa:
//      padrões telegrafados, janelas de punição generosas
// B — "sua ciência não vale nada"               → competitiva:
//      cadência aumentada, experimentos mais perigosos
export type SandyMood = 'respeitosa' | 'competitiva' | null;

export class SandyBochechas extends BaseBoss {
  private mood: SandyMood = null;

  // Sequência de lasers: telegraph é desenhado pelo próprio boss;
  // os tiros prontos ficam na fila até o m1 do frame seguinte coletar
  private queuedShots: ProjectileData[] = [];
  private sequenceActive: boolean = false;

  // Painel de controle: bônus de velocidade enquanto verde (GDD)
  private boostActive: boolean = false;

  // Granadas de gelo (fase final)
  private lastGrenadeTime: number = 0;

  // Robô de Teste (M2 gerido pela cena)
  private lastRobotTime: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const config: BossConfig = {
      bossId: 'sandy',
      hp: CONSTANTS.SANDY_HP,
      finalPhaseThreshold: CONSTANTS.SANDY_FINAL_PHASE,
      m1Cooldown: 5200,
      m2Cooldown: 999_999, // robô e granadas têm relógios próprios
      finalPhaseSpeedMultiplier: 1.15,
      finalPhaseDamageMultiplier: 1.0,
      projectilePoolSize: 25,
      projectileColor: 0xff5252,
      projectileWidth: 46,
      projectileHeight: 8,
      projectileSpeed: CONSTANTS.SANDY_LASER_SPEED,
      projectileDamage: CONSTANTS.SANDY_LASER_DAMAGE,
    };
    super(scene, x, y, config);
  }

  // ── Mood / boost ──────────────────────────────────────────────

  setMood(mood: SandyMood): void {
    this.mood = mood;
  }

  setBoost(active: boolean): void {
    this.boostActive = active;
    // Feedback: Sandy vibra de energia enquanto o painel está verde
    if (active) {
      this.scene.tweens.add({
        targets: this, scaleX: 1.06, scaleY: 1.06, duration: 150, yoyo: true,
      });
    }
  }

  isBoosted(): boolean {
    return this.boostActive;
  }

  /** Destruir o painel cancela o bônus, mas antecipa a fase final (GDD). */
  forceFinalPhase(): void {
    if (this.isFinalPhase || this.isDefeated) return;
    this.isFinalPhase = true;
    this.onFinalPhase();
    EventBus.emit('boss:final-phase', { bossId: 'sandy' });
  }

  private chargeMs(): number {
    if (this.mood === 'respeitosa') return CONSTANTS.SANDY_LASER_CHARGE_MS * 1.3;
    if (this.mood === 'competitiva') return CONSTANTS.SANDY_LASER_CHARGE_MS * 0.7;
    return CONSTANTS.SANDY_LASER_CHARGE_MS;
  }

  private gapMs(): number {
    if (this.mood === 'respeitosa') return CONSTANTS.SANDY_LASER_GAP_MS * 1.25;
    if (this.mood === 'competitiva') return CONSTANTS.SANDY_LASER_GAP_MS * 0.75;
    return CONSTANTS.SANDY_LASER_GAP_MS;
  }

  private m1CooldownNow(): number {
    let cd = this.config.m1Cooldown;
    if (this.mood === 'respeitosa') cd *= 1.3;   // janelas de punição generosas
    if (this.mood === 'competitiva') cd *= 0.7;  // cadência aumentada
    if (this.boostActive) cd *= 0.65;            // painel verde
    return cd;
  }

  private laserSpeed(): number {
    let speed = this.config.projectileSpeed;
    if (this.isFinalPhase) speed *= this.config.finalPhaseSpeedMultiplier;
    if (this.mood === 'competitiva') speed *= 1.1;
    if (this.boostActive) speed *= 1.2;
    return speed;
  }

  // ── BaseBoss impl ─────────────────────────────────────────────

  getBossId(): BossId {
    return 'sandy';
  }

  buildVisual(): void {
    // dx=-13: a arma de raios se estende à esquerda e a cauda à direita —
    // desloca p/ centrar o corpo na hitbox.
    const sprite = this.scene.add.sprite(-13, 0, 'sandy-boss');
    sprite.setDisplaySize(173, 138);
    this.add(sprite);
    this.feetOffset = sprite.displayHeight / 2; // habilita patrulha/pulo

    const label = this.scene.add
      .text(0, -100, 'SANDY', {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: '13px',
        color: '#FFE0B2',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(label);
  }

  m1(time: number, _targetX?: number, _targetY?: number): ProjectileData[] {
    // Sempre entrega o que os telegraphs deixaram pronto
    const ready = this.queuedShots.splice(0);

    if (!this.sequenceActive && time - this.lastM1Time >= this.m1CooldownNow()) {
      this.lastM1Time = time;
      this.startLaserSequence();
    }

    return ready;
  }

  // GDD: quatro lasers horizontais em sequência, cada um em altura
  // ligeiramente diferente, com carregamento visível antes de disparar
  private startLaserSequence(): void {
    this.sequenceActive = true;

    const groundY = this.y + 70; // pés da Sandy
    const heights = [40, 105, 170, 235].map(
      (h) => groundY - h + Phaser.Math.Between(-12, 12),
    );

    const charge = this.chargeMs();
    const gap = this.gapMs();

    heights.forEach((laserY, i) => {
      this.scene.time.delayedCall(i * gap, () => {
        if (this.isDefeated) return;
        this.chargeLaser(laserY, charge);
      });
    });

    const total = (heights.length - 1) * gap + charge + 200;
    this.scene.time.delayedCall(total, () => {
      this.sequenceActive = false;
    });
  }

  private chargeLaser(laserY: number, charge: number): void {
    // Linha de aviso tracejada atravessando a arena — carregamento visível
    // (GDD). Tracejado + pulso de alpha lê melhor sobre o cenário foto.
    const warn = this.scene.add.graphics().setDepth(4).setAlpha(0.2);
    warn.lineStyle(3, 0xff1744, 1);
    const DASH = 18;
    const GAP_PX = 12;
    for (let x = 0; x < CONSTANTS.GAME_WIDTH; x += DASH + GAP_PX) {
      warn.lineBetween(x, laserY, Math.min(x + DASH, CONSTANTS.GAME_WIDTH), laserY);
    }
    // Marcador na borda de origem: o tiro nasce na Sandy e viaja para a esquerda
    const marker = this.scene.add
      .text(this.x - 52, laserY, '◀', {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: '14px',
        color: '#ff1744',
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.scene.tweens.add({
      targets: [warn, marker],
      alpha: 0.6,
      duration: charge / 4,
      yoyo: true,
      repeat: 1,
    });

    this.scene.time.delayedCall(charge, () => {
      warn.destroy();
      marker.destroy();
      if (this.isDefeated) return;

      // Clarão localizado no cano — flash de tela inteira piscava demais
      // com 4 lasers em sequência
      const muzzle = this.scene.add
        .ellipse(this.x - 60, laserY, 36, 20, 0xff5252, 0.85)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(5);
      this.scene.tweens.add({
        targets: muzzle,
        scaleX: 1.8,
        scaleY: 1.4,
        alpha: 0,
        duration: 130,
        ease: 'Quad.easeOut',
        onComplete: () => muzzle.destroy(),
      });

      this.queuedShots.push({
        x: this.x - 60,
        y: laserY,
        velocityX: -this.laserSpeed(),
        velocityY: 0,
        damage: this.config.projectileDamage,
      });
    });
  }

  // Granadas de gelo — só na fase final (GDD)
  m2(time: number, targetX?: number): ProjectileData[] {
    if (!this.isFinalPhase) return [];
    if (this.lastGrenadeTime === 0) {
      this.lastGrenadeTime = time;
      return [];
    }
    if (time - this.lastGrenadeTime < CONSTANTS.ICE_GRENADE_COOLDOWN_MS) return [];
    this.lastGrenadeTime = time;

    const dx = (targetX ?? 0) - this.x;
    const dir = dx < 0 ? -1 : 1;
    const dist = Math.min(Math.abs(dx), 900);

    // Dois arcos: um no jogador, outro um pouco mais curto
    return [1.0, 0.7].map((frac) => ({
      x: this.x,
      y: this.y - 60,
      velocityX: dir * (dist * frac) * 0.55,
      velocityY: -430,
      damage: CONSTANTS.ICE_GRENADE_DAMAGE,
      textureKey: 'ice-grenade',
      gravity: true,
      effect: 'freeze' as const,
      lifespanMs: 2600,
      trailTint: 0xb2ebf2, // rastro de neve, não o vermelho dos lasers
    }));
  }

  /**
   * Robô de Teste (M2 do GDD) — a cena pergunta a cada frame;
   * quando o cooldown vence, retorna true para invocar.
   */
  tryRequestRobot(time: number): boolean {
    if (this.isDefeated) return false;
    if (this.lastRobotTime === 0) {
      this.lastRobotTime = time - CONSTANTS.SANDY_ROBOT_COOLDOWN_MS / 2;
      return false;
    }
    if (time - this.lastRobotTime < CONSTANTS.SANDY_ROBOT_COOLDOWN_MS) return false;
    this.lastRobotTime = time;
    return true;
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
    return new Phaser.Geom.Rectangle(this.x - 50, this.y - 108, 100, 195);
  }
}
