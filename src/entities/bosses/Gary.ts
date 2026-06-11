import * as Phaser from 'phaser';


export class Gary extends Phaser.Physics.Arcade.Sprite {
  private isRolling: boolean = false;
  private slimeTimer: Phaser.Time.TimerEvent | null = null;
  private slimesGroup: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, x: number, y: number, slimesGroup: Phaser.Physics.Arcade.Group) {
    // Criar a textura do Gary se não existir
    if (!scene.textures.exists('gary')) {
      const g = scene.add.graphics();
      // Casca do Gary (rosa com pintas vermelhas/espiral)
      g.fillStyle(0xff8a80, 1);
      g.fillCircle(16, 16, 14);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(16, 16, 8);
      g.fillStyle(0xff8a80, 1);
      g.fillCircle(16, 16, 4);

      // Corpo (ciano/verde-água)
      g.fillStyle(0x80deea, 1);
      g.fillRoundedRect(14, 20, 24, 10, 3);

      // Olhos (pedúnculos + círculos brancos + pupilas vermelhas)
      g.lineStyle(2, 0x80deea, 1);
      g.lineBetween(22, 10, 22, 4);
      g.lineBetween(28, 12, 28, 6);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(22, 4, 3);
      g.fillCircle(28, 6, 3);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(22, 4, 1.2);
      g.fillCircle(28, 6, 1.2);

      g.generateTexture('gary', 38, 32);
      g.destroy();
    }

    // Criar casca sozinha para o modo rolagem
    if (!scene.textures.exists('gary-shell')) {
      const g = scene.add.graphics();
      g.fillStyle(0xff8a80, 1);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(16, 16, 9);
      g.fillStyle(0xff8a80, 1);
      g.fillCircle(16, 16, 4);
      g.generateTexture('gary-shell', 32, 32);
      g.destroy();
    }

    super(scene, x, y, 'gary');
    this.slimesGroup = slimesGroup;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(3);
    this.setVisible(false);
    this.setActive(false);
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
  }

  startAttack(fromLeft: boolean, speed: number): void {
    this.setVisible(true);
    this.setActive(true);
    this.isRolling = true;

    const startX = fromLeft ? -50 : 1330;
    const groundY = 645; // Linha do chão do Gary

    this.setPosition(startX, groundY);
    this.setTexture('gary-shell');

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(fromLeft ? speed : -speed);

    // Girar casca enquanto rola
    this.scene.tweens.add({
      targets: this,
      angle: fromLeft ? 360 : -360,
      duration: 800,
      repeat: -1,
    });

    // Iniciar timer de rastro de gosma
    this.slimeTimer?.remove();
    this.slimeTimer = this.scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        if (!this.active || !this.visible) return;
        this.dropSlime();
      },
    });
  }

  private dropSlime(): void {
    const slime = this.slimesGroup.get(this.x, this.y + 12) as Phaser.Physics.Arcade.Sprite | null;
    if (!slime) return;

    slime.setActive(true).setVisible(true);
    slime.setAlpha(0.75);
    slime.setScale(1);
    
    // Rastro some depois de 5s (GDD)
    this.scene.tweens.add({
      targets: slime,
      alpha: 0,
      duration: 1200,
      delay: 3800,
      onComplete: () => {
        slime.setActive(false).setVisible(false);
      },
    });
  }

  update(): void {
    if (!this.active) return;

    const { width } = this.scene.scale;
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Se saiu da tela, encerra ataque
    if ((body.velocity.x > 0 && this.x > width + 100) || (body.velocity.x < 0 && this.x < -100)) {
      this.stopAttack();
    }
  }

  stopAttack(): void {
    this.setVisible(false);
    this.setActive(false);
    this.isRolling = false;
    this.slimeTimer?.remove();
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocityX(0);
    }
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
    }
    this.setAngle(0);
  }

  override destroy(fromScene?: boolean): void {
    this.slimeTimer?.remove();
    super.destroy(fromScene);
  }

  isRollingActive(): boolean {
    return this.isRolling;
  }
}
