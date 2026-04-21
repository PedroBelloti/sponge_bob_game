import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';

export class BobEsponja extends Phaser.Physics.Arcade.Sprite {
  private hp: number = 3;
  private invincible: boolean = false;
  private label: Phaser.GameObjects.Text;

  private shiftKey: Phaser.Input.Keyboard.Key;
  private sKey: Phaser.Input.Keyboard.Key;
  private dashCooldown: boolean = false;
  private isDashing: boolean = false;
  private dashUsedInAir: boolean = false;
  private isCrouching: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bob-placeholder');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // Depth 2 garante que ghosts (depth 1) ficam atrás do Bob
    this.setDepth(2);

    this.label = scene.add.text(x, y - 40, 'BOB', {
      fontSize: '14px',
      color: '#000000',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setDepth(10);

    this.shiftKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.sKey     = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  }

  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd?: { W?: Phaser.Input.Keyboard.Key; A?: Phaser.Input.Keyboard.Key; D?: Phaser.Input.Keyboard.Key },
  ): void {
    this.updateCrouch();

    const body = this.body as Phaser.Physics.Arcade.Body;

    const goLeft  = cursors.left?.isDown  || wasd?.A?.isDown;
    const goRight = cursors.right?.isDown || wasd?.D?.isDown;
    const jump    = cursors.up?.isDown    || cursors.space?.isDown || wasd?.W?.isDown;

    // Atualiza a direção visual para orientar o ghost corretamente
    if (goLeft)  this.setFlipX(true);
    if (goRight) this.setFlipX(false);

    // Reseta o dash aéreo ao tocar o chão
    if (body.blocked.down) {
      this.dashUsedInAir = false;
    }

    // Dash no SHIFT:
    //   no chão  → limitado apenas pelo cooldown
    //   no ar    → permitido uma única vez até o próximo pouso
    const canDash = !this.dashCooldown && (body.blocked.down || !this.dashUsedInAir);
    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && canDash) {
      if (!body.blocked.down) this.dashUsedInAir = true;
      const dir = goLeft ? -1 : goRight ? 1 : (this.flipX ? -1 : 1);
      this.performDash(dir);
    }

    // Movimento normal — suspenso durante o burst do dash
    if (!this.isDashing) {
      if (goLeft)       body.setVelocityX(-CONSTANTS.BOB_PROLOGO_SPEED);
      else if (goRight) body.setVelocityX(CONSTANTS.BOB_PROLOGO_SPEED);
      else              body.setVelocityX(0);
    }

    if (jump && body.blocked.down) {
      body.setVelocityY(-CONSTANTS.BOB_PROLOGO_JUMP_VELOCITY);
    }

    // Label acompanha o topo do sprite independente do estado de crouch
    this.label.setPosition(this.x, this.y - (this.isCrouching ? 24 : 40));
  }

  private updateCrouch(): void {
    const shouldCrouch = this.sKey.isDown;
    if (shouldCrouch === this.isCrouching) return;

    this.isCrouching = shouldCrouch;
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Captura a posição dos pés ANTES de qualquer mudança
    const feetY = body.bottom;

    if (this.isCrouching) {
      this.setScale(1, 0.5);
      body.setSize(48, 32, false);
      body.setOffset(0, 32);
    } else {
      this.setScale(1, 1);
      body.setSize(48, 64, false);
      body.setOffset(0, 0);
    }

    // Pino explícito: garante que sprite.y seja o valor correto para que o
    // preUpdate do próximo frame recalcule body.y sem nenhum drift intermediário.
    // sprite.y = feetY − halfSpriteHeight (32) é invariante entre os dois estados.
    this.y = feetY - 32;
  }

  private performDash(direction: number): void {
    this.isDashing = true;
    this.dashCooldown = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(direction * CONSTANTS.PLAYER_DASH_SPEED);

    this.spawnGhostTrail();

    // Encerra o burst de velocidade após DASH_DURATION
    this.scene.time.delayedCall(CONSTANTS.PLAYER_DASH_DURATION, () => {
      this.isDashing = false;
    });

    // Libera o cooldown após DASH_COOLDOWN
    this.scene.time.delayedCall(CONSTANTS.PLAYER_DASH_COOLDOWN, () => {
      this.dashCooldown = false;
    });
  }

  private spawnGhostTrail(): void {
    const GHOST_COUNT = 4;
    const SPAWN_INTERVAL = 35; // ms entre cada frame do rastro

    for (let i = 0; i < GHOST_COUNT; i++) {
      this.scene.time.delayedCall(i * SPAWN_INTERVAL, () => {
        if (!this.active) return;

        const ghost = this.scene.add.image(this.x, this.y, 'bob-placeholder');
        ghost.setFlipX(this.flipX);
        ghost.setScale(this.scaleX, this.scaleY);
        ghost.setAlpha(0.35);
        ghost.setDepth(1); // atrás do Bob (depth 2), na frente do fundo

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
      (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
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
