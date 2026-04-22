import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { PlayerBase } from './PlayerBase';

export class BobEsponja extends PlayerBase {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bob-placeholder', {
      speed:            CONSTANTS.BOB_SPEED,
      jumpVelocity:     -CONSTANTS.BOB_JUMP_VELOCITY,
      maxHp:            CONSTANTS.BOB_MAX_HP,
      dashSpeed:        CONSTANTS.BOB_DASH_SPEED,
      dashDuration:     CONSTANTS.BOB_DASH_DURATION,
      dashCooldown:     CONSTANTS.BOB_DASH_COOLDOWN,
      projectileDamage: CONSTANTS.BOB_PROJECTILE_DAMAGE,
      projectileSpeed:  CONSTANTS.BOB_PROJECTILE_SPEED,
      fireCooldown:     CONSTANTS.BOB_FIRE_COOLDOWN,
      projectileColor:  0x4fc3f7,
      projectileWidth:  14,
      projectileHeight: 14,
    });

    this.setDepth(2);

    this.label = scene.add
      .text(x, y - 40, 'BOB', { fontSize: '14px', color: '#000000', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(10);
  }

  onDeath(): void {
    EventBus.emit('prologo:bob-derrotado', undefined);
  }

  getProjectileTextureKey(): string {
    return 'bob-projectile';
  }

  protected onDashStart(_direction: number): void {
    const GHOST_COUNT = 4;
    const SPAWN_INTERVAL = 35;
    for (let i = 0; i < GHOST_COUNT; i++) {
      this.scene.time.delayedCall(i * SPAWN_INTERVAL, () => {
        if (!this.active) return;
        const ghost = this.scene.add.image(this.x, this.y, 'bob-placeholder');
        ghost.setFlipX(this.flipX);
        ghost.setScale(this.scaleX, this.scaleY);
        ghost.setAlpha(0.35).setDepth(1);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 280,
          ease: 'Linear',
          onComplete: () => ghost.destroy(),
        });
      });
    }
  }
}
