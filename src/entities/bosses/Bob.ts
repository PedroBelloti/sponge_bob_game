import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import type { BossId } from '../../core/EventBus';
import { BaseBoss } from './BaseBoss';
import type { BossConfig, ProjectileData } from './BaseBoss';
import { ATTACK_PALETTES, makeGlowTexture } from '../../config/theme';

export type BobMood = 'triste' | 'determinado' | null;

export class Bob extends BaseBoss {
  private mood: BobMood = null;
  private sprite!: Phaser.GameObjects.Sprite;
  private shield!: Phaser.GameObjects.Image;
  private isAbsorbing: boolean = false;
  private queuedShots: ProjectileData[] = [];
  private sequenceActive: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const config: BossConfig = {
      bossId: 'bob',
      hp: CONSTANTS.BOB_HP,
      finalPhaseThreshold: CONSTANTS.BOB_FINAL_PHASE,
      m1Cooldown: 3000,
      m2Cooldown: 7000, // Cooldown de absorção
      finalPhaseSpeedMultiplier: 1.25,
      finalPhaseDamageMultiplier: 1.0,
      projectilePoolSize: 30,
      projectileColor: 0xffb300, // Ambar de lanchonete
      projectileWidth: 32,
      projectileHeight: 26,
      projectileSpeed: 450,
      projectileDamage: 1,
    };
    super(scene, x, y, config);

    // Criar textura de escudo se não existir
    if (!scene.textures.exists('absorb-shield')) {
      makeGlowTexture(scene, 'absorb-shield', ATTACK_PALETTES.bob, 80);
    }

    this.shield = scene.add.image(0, -60, 'absorb-shield');
    this.shield.setBlendMode(Phaser.BlendModes.ADD);
    this.shield.setVisible(false);
    this.add(this.shield);

    // Pulse effect on shield
    scene.tweens.add({
      targets: this.shield,
      alpha: 0.4,
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setMood(mood: BobMood): void {
    this.mood = mood;
  }

  getMood(): BobMood {
    return this.mood;
  }

  isAbsorbingActive(): boolean {
    return this.isAbsorbing;
  }

  private m1CooldownNow(): number {
    let cd = this.config.m1Cooldown;
    if (this.mood === 'triste') cd *= 1.4; // Mais lento, com pausas
    if (this.mood === 'determinado') cd *= 0.75; // Determinado, sem pausas
    if (this.isFinalPhase) cd *= 0.8;
    return cd;
  }

  private m2CooldownNow(): number {
    let cd = this.config.m2Cooldown;
    if (this.mood === 'triste') cd *= 1.3;
    if (this.mood === 'determinado') cd *= 0.85;
    return cd;
  }

  private hamburgerSpeed(): number {
    let speed = this.config.projectileSpeed;
    if (this.mood === 'determinado') speed *= 1.15;
    if (this.isFinalPhase) speed *= this.config.finalPhaseSpeedMultiplier;
    return speed;
  }

  // ── BaseBoss impl ─────────────────────────────────────────────

  getBossId(): BossId {
    return 'bob';
  }

  buildVisual(): void {
    // Adiciona o sprite animado do Bob
    this.sprite = this.scene.add.sprite(0, 0, 'bob-placeholder').setOrigin(0.5, 1);
    this.sprite.setFlipX(true); // Olha para a esquerda (Plankton)
    this.add(this.sprite);

    // Rótulo com o nome
    const label = this.scene.add
      .text(0, -130, 'BOB ESPONJA', {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: '12px',
        color: '#FFD54F',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(label);
  }

  m1(time: number, targetX?: number, targetY?: number): ProjectileData[] {
    const ready = this.queuedShots.splice(0);

    if (!this.sequenceActive && time - this.lastM1Time >= this.m1CooldownNow()) {
      this.lastM1Time = time;
      this.startBurgerSequence(targetX, targetY);
    }

    return ready;
  }

  private startBurgerSequence(targetX?: number, targetY?: number): void {
    this.sequenceActive = true;

    // Telegraph: pulso na escala do Bob
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.08,
      scaleY: this.scaleY * 1.08,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // Pequenas bolhas de sabão, em leque, miradas perto do Plankton
    const throwBubbles = (delay: number) => {
      this.scene.time.delayedCall(delay, () => {
        if (this.isDefeated) return;

        const tx = targetX ?? this.x - 300;
        const ty = targetY ?? this.y - 50;
        const startX = this.x - 40;
        const startY = this.y - 60;
        const base = Phaser.Math.Angle.Between(startX, startY, tx, ty);

        const muzzle = this.scene.add
          .ellipse(startX, startY, 20, 20, 0x81d4fa, 0.8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(5);
        this.scene.tweens.add({
          targets: muzzle, scale: 1.6, alpha: 0, duration: 120,
          onComplete: () => muzzle.destroy(),
        });

        [-0.16, 0, 0.16].forEach((off) => {
          const a = base + off;
          this.queuedShots.push({
            x: startX, y: startY,
            velocityX: Math.cos(a) * this.hamburgerSpeed(),
            velocityY: Math.sin(a) * this.hamburgerSpeed(),
            damage: this.config.projectileDamage,
            textureKey: 'bob-bubble',
            trailTint: 0x81d4fa,
          });
        });
      });
    };

    // Duas salvas de bolhas
    throwBubbles(250);
    throwBubbles(650);

    this.scene.time.delayedCall(900, () => {
      this.sequenceActive = false;
    });
  }

  m2(time: number): ProjectileData[] {
    if (this.isDefeated) return [];

    if (time - this.lastM2Time >= this.m2CooldownNow()) {
      this.lastM2Time = time;
      this.startAbsorbing();
    }

    return [];
  }

  private startAbsorbing(): void {
    if (this.isDefeated) return;
    this.isAbsorbing = true;
    this.shield.setVisible(true);
    this.shield.setScale(0.1);
    this.shield.setAlpha(0.85);

    this.scene.tweens.add({
      targets: this.shield,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });

    // Janela de absorção de 2 segundos (GDD)
    this.scene.time.delayedCall(2000, () => {
      if (this.isAbsorbing) {
        this.isAbsorbing = false;
        this.scene.tweens.add({
          targets: this.shield,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            this.shield.setVisible(false);
          },
        });
      }
    });
  }

  override receiveDamage(amount: number): void {
    if (this.isAbsorbing) {
      this.triggerReturnAttack();
      return; // Absorvido! Sem dano.
    }
    super.receiveDamage(amount);
  }

  private triggerReturnAttack(): void {
    this.isAbsorbing = false;
    this.shield.setVisible(false);

    // Tremor de absorção no Bob
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.12,
      scaleY: this.scaleY * 1.12,
      duration: 100,
      yoyo: true,
    });

    // Devolve o projétil em direção ao Plankton
    const target = (this.scene as any).plankton;
    const targetX = target ? target.x : this.x - 300;
    const targetY = target ? target.y : this.y - 50;
    const startX = this.x;
    const startY = this.y - 60;
    const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);

    this.queuedShots.push({
      x: startX,
      y: startY,
      velocityX: Math.cos(angle) * (this.hamburgerSpeed() * 1.25),
      velocityY: Math.sin(angle) * (this.hamburgerSpeed() * 1.25),
      damage: this.config.projectileDamage,
      textureKey: 'bob-bubble', // bolha de sabão devolvida
      trailTint: 0x29b6f6,
    });
  }

  onFinalPhase(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 200,
      yoyo: true,
      repeat: 1,
    });
  }

  getHitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(this.x - 50, this.y - 110, 100, 110);
  }
}
