import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';

export class BobEsponja extends Phaser.Physics.Arcade.Sprite {
  private hp: number = 3;
  private invincible: boolean = false;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bob-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    this.label = scene.add.text(x, y - 40, 'BOB', {
      fontSize: '14px',
      color: '#000000',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setDepth(10);
  }

  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd?: { W?: Phaser.Input.Keyboard.Key; A?: Phaser.Input.Keyboard.Key; D?: Phaser.Input.Keyboard.Key },
  ): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    const goLeft  = cursors.left?.isDown  || wasd?.A?.isDown;
    const goRight = cursors.right?.isDown || wasd?.D?.isDown;
    const jump    = cursors.up?.isDown    || cursors.space?.isDown || wasd?.W?.isDown;

    if (goLeft)       body.setVelocityX(-CONSTANTS.BOB_PROLOGO_SPEED);
    else if (goRight) body.setVelocityX(CONSTANTS.BOB_PROLOGO_SPEED);
    else              body.setVelocityX(0);

    if (jump && body.blocked.down) {
      body.setVelocityY(-CONSTANTS.BOB_PROLOGO_JUMP_VELOCITY);
    }

    this.label.setPosition(this.x, this.y - 40);
  }

  receiveDamage(): void {
    if (this.invincible) return;

    this.hp = Math.max(0, this.hp - 1);
    this.invincible = true;

    this.setAlpha(0.5);
    this.scene.time.delayedCall(1000, () => {
      this.invincible = false;
      this.setAlpha(1);
    });

    if (this.hp <= 0) {
      EventBus.emit('prologo:bob-derrotado', undefined);
    }
  }

  getHp(): number {
    return this.hp;
  }

  destroy(fromScene?: boolean): void {
    this.label?.destroy();
    super.destroy(fromScene);
  }
}
