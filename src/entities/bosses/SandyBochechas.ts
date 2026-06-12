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

  m1(_time: number): ProjectileData[] {
    // A cadência e o teto de 4 lasers ativos são geridos pela cena
    // (fireLaserNearPlayer). Aqui só entregamos os tiros já carregados.
    return this.queuedShots.splice(0);
  }

  private laserSpeedNow(): number {
    let speed = 980; // mais rápido que antes (era 700)
    if (this.isFinalPhase) speed *= this.config.finalPhaseSpeedMultiplier;
    if (this.mood === 'competitiva') speed *= 1.1;
    if (this.boostActive) speed *= 1.2;
    return speed;
  }

  /**
   * Dispara UM laser de uma borda aleatória — horizontal OU vertical —
   * mirando perto do Plankton. Rápido, com telegrafo curto. A cena controla a
   * cadência e o limite de 4 ativos.
   */
  fireLaserNearPlayer(px: number, py: number): void {
    if (this.isDefeated) return;
    const W = CONSTANTS.GAME_WIDTH, H = CONSTANTS.GAME_HEIGHT;
    const speed = this.laserSpeedNow();
    const charge = this.chargeMs() * 0.6; // telegrafo curto = laser rápido
    const edge = Phaser.Math.Between(0, 3); // 0 dir, 1 esq, 2 topo, 3 base

    let origin: { x: number; y: number };
    let vel: { x: number; y: number };
    let rotation = 0;
    // IMPORTANTE: nascer DENTRO da margem de cull (±20px) ou o tiro é removido
    // no mesmo frame. Nasce na própria borda da tela e viaja para dentro.
    if (edge <= 1) {
      const ly = Phaser.Math.Clamp(py + Phaser.Math.Between(-70, 70), 40, H - 40);
      origin = { x: edge === 0 ? W - 6 : 6, y: ly };
      vel = { x: edge === 0 ? -speed : speed, y: 0 };
    } else {
      const lx = Phaser.Math.Clamp(px + Phaser.Math.Between(-70, 70), 40, W - 40);
      origin = { x: lx, y: edge === 2 ? 6 : H - 6 };
      vel = { x: 0, y: edge === 2 ? speed : -speed };
      rotation = Math.PI / 2;
    }
    this.chargeLaser(origin, vel, rotation, charge);
  }

  private chargeLaser(
    origin: { x: number; y: number },
    vel: { x: number; y: number },
    rotation: number,
    charge: number,
  ): void {
    const W = CONSTANTS.GAME_WIDTH, H = CONSTANTS.GAME_HEIGHT;
    const horizontal = vel.y === 0;
    const warn = this.scene.add.graphics().setDepth(4).setAlpha(0.25);
    warn.lineStyle(3, 0xff1744, 1);
    const DASH = 18, GAP_PX = 12;
    if (horizontal) {
      for (let x = 0; x < W; x += DASH + GAP_PX) {
        warn.lineBetween(x, origin.y, Math.min(x + DASH, W), origin.y);
      }
    } else {
      for (let y = 0; y < H; y += DASH + GAP_PX) {
        warn.lineBetween(origin.x, y, origin.x, Math.min(y + DASH, H));
      }
    }
    this.scene.tweens.add({ targets: warn, alpha: 0.7, duration: charge / 4, yoyo: true, repeat: 1 });

    this.scene.time.delayedCall(charge, () => {
      warn.destroy();
      if (this.isDefeated) return;
      this.queuedShots.push({
        x: origin.x, y: origin.y,
        velocityX: vel.x, velocityY: vel.y,
        damage: this.config.projectileDamage,
        rotation,
      });
    });
  }

  // Bolas de gelo: jogadas SEMPRE, em posições aleatórias da arena. A cena
  // detecta o pouso (chão ou plataforma) e cria a poça de gelo que escorrega.
  m2(time: number): ProjectileData[] {
    const cd = this.isFinalPhase
      ? CONSTANTS.ICE_GRENADE_COOLDOWN_MS * 0.55
      : CONSTANTS.ICE_GRENADE_COOLDOWN_MS;
    if (this.lastGrenadeTime === 0) {
      this.lastGrenadeTime = time;
      return [];
    }
    if (time - this.lastGrenadeTime < cd) return [];
    this.lastGrenadeTime = time;

    // Arco em direção a um X aleatório da arena
    return [{
      x: this.x, y: this.y - 60,
      velocityX: Phaser.Math.Between(-420, 420),
      velocityY: -440,
      damage: CONSTANTS.ICE_GRENADE_DAMAGE,
      textureKey: 'ice-grenade',
      gravity: true,
      effect: 'freeze' as const,
      lifespanMs: 5000,
      trailTint: 0xb2ebf2,
    }];
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
