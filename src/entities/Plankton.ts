import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { PlayerBase } from './PlayerBase';

export class Plankton extends PlayerBase {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'plankton-placeholder', {
      speed:            CONSTANTS.PLANKTON_SPEED,
      jumpVelocity:     -CONSTANTS.PLANKTON_JUMP_VELOCITY,
      maxHp:            CONSTANTS.PLANKTON_MAX_HP,
      dashSpeed:        CONSTANTS.PLANKTON_DASH_SPEED,
      dashDuration:     CONSTANTS.PLANKTON_DASH_DURATION,
      dashCooldown:     CONSTANTS.PLANKTON_DASH_COOLDOWN,
      projectileDamage: CONSTANTS.PLANKTON_LASER_DAMAGE,
      projectileSpeed:  CONSTANTS.PLANKTON_LASER_SPEED,
      fireCooldown:     CONSTANTS.PLANKTON_LASER_FIRE_INTERVAL,
      projectileColor:  0xff6f00,
      projectileWidth:  16,
      projectileHeight: 4,
    });

    this.setDepth(2);
    this.labelOffsetY = 36;

    this.label = scene.add
      .text(x, y - 36, 'PLANKTON', { fontSize: '12px', color: '#4CAF50' })
      .setOrigin(0.5)
      .setDepth(10);
  }

  onDeath(): void {
    EventBus.emit('player:defeated', undefined);
  }

  getProjectileTextureKey(): string {
    return 'plankton-laser';
  }
}
