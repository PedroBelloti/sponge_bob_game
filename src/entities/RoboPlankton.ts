import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';

interface ProjectileData {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class RoboPlankton extends Phaser.GameObjects.Container {
  private readonly baseY: number;

  private hp: number = 50;
  static readonly MAX_HP = 50;
  // Never dies — stops at 1 HP so the bar looks "almost dead" but never empties
  private static readonly MIN_HP = 1;

  // Eye is 130px above the container base (ground level)
  private static readonly EYE_OFFSET_Y = -130;

  constructor(scene: Phaser.Scene, groundY: number) {
    const x = CONSTANTS.GAME_WIDTH - 180;
    super(scene, x, groundY);

    this.baseY = groundY;
    this.buildVisuals();
    scene.add.existing(this);
    this.startAnimations();
  }

  private buildVisuals(): void {
    const g = this.scene.add.graphics();

    // Arms (behind body, draw first)
    g.fillStyle(0x1b5e20, 1);
    g.fillRect(-80, -150, 20, 60); // left arm
    g.fillRect(60, -150, 20, 60);  // right arm

    // Base / legs
    g.fillRect(-70, -30, 140, 30);

    // Body
    g.fillStyle(0x2e7d32, 1);
    g.fillRect(-60, -190, 120, 160);

    // Eye (red) — slightly above body center (center = -110, eye at -130)
    g.fillStyle(0xff1744, 1);
    g.fillCircle(0, RoboPlankton.EYE_OFFSET_Y, 30);

    // Pupil
    g.fillStyle(0x000000, 1);
    g.fillCircle(0, RoboPlankton.EYE_OFFSET_Y, 12);

    this.add(g);
  }

  private startAnimations(): void {
    // Float: bobs 15px up and down
    this.scene.tweens.add({
      targets: this,
      y: this.baseY - 15,
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Gentle rotation: -3° ↔ +3°
    this.setAngle(-3);
    this.scene.tweens.add({
      targets: this,
      angle: 3,
      duration: 2200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  getHp(): number { return this.hp; }

  /** Bounding rectangle in world space — follows the float animation. */
  getHitBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - 80,   // left edge (arm)
      this.y - 190,  // top of body
      160,            // arm-to-arm width
      195,            // body + legs height
    );
  }

  receiveDamage(amount: number): void {
    this.hp = Math.max(RoboPlankton.MIN_HP, this.hp - amount);
    // Brief flash — signals the hit without stopping movement
    this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      duration: 60,
      yoyo: true,
    });
  }

  /**
   * Calculates aim from the eye toward the target.
   * The Scene uses the returned data to place and drive a projectile from its pool.
   */
  fireProjectile(targetX: number, targetY: number): ProjectileData {
    const eyeX = this.x;
    const eyeY = this.y + RoboPlankton.EYE_OFFSET_Y;
    const angle = Phaser.Math.Angle.Between(eyeX, eyeY, targetX, targetY);
    const speed = CONSTANTS.PROLOGO_ROBO_PROJECTILE_SPEED;
    return {
      x: eyeX,
      y: eyeY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    };
  }
}
