import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { SandyBochechas } from '../../entities/bosses/SandyBochechas';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_SANDY } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';

interface TestRobot {
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  expireAt: number;
  lastPushAt: number;
}

export class Phase3Scene extends BossPhaseScene {
  private sandy!: SandyBochechas;

  // Painel de controle (GDD): verde = boost da Sandy; destrutível
  private panelLight!: Phaser.GameObjects.Arc;
  private panelBody!: Phaser.GameObjects.Rectangle;
  private panelHp: number = CONSTANTS.PANEL_HP;
  private panelDestroyed: boolean = false;
  private panelCycleTimer: Phaser.Time.TimerEvent | null = null;
  private readonly panelX = 640;
  private readonly panelY = 525;

  // Robôs de Teste
  private robots: TestRobot[] = [];

  constructor() {
    super({ key: 'Phase3Scene' });
  }

  // ── BossPhaseScene impl ───────────────────────────────────────

  protected buildArena(width: number, height: number): void {
    this.buildTextures();

    // Água profunda ao redor da cúpula
    this.add.rectangle(width / 2, height / 2, width, height, 0x04101c);

    // Bolhas distantes
    const gfx = this.add.graphics();
    gfx.fillStyle(0x4fc3f7, 0.08);
    ([[180, 200, 7], [420, 120, 4], [760, 90, 6], [1010, 170, 5], [1180, 320, 8]] as
      [number, number, number][]).forEach(([x, y, r]) => gfx.fillCircle(x, y, r));

    // Vidro da cúpula
    const dome = this.add.graphics();
    dome.lineStyle(5, 0x4fc3f7, 0.22);
    dome.beginPath();
    dome.arc(width / 2, height - 20, 640, Math.PI, 0, false);
    dome.strokePath();
    dome.lineStyle(2, 0x4fc3f7, 0.12);
    dome.beginPath();
    dome.arc(width / 2, height - 20, 600, Math.PI, 0, false);
    dome.strokePath();

    this.add.text(16, 16, 'CÚPULA SUBMARINA', { fontSize: '14px', color: '#4FC3F7' });

    // Plantas texanas
    this.buildCactus(450, height - 50);
    this.buildCactus(850, height - 50);

    // Chão de terra da cúpula
    this.ground = this.physics.add.staticGroup();
    (this.ground.create(width / 2, height - 25, 'phase3-ground') as Phaser.Physics.Arcade.Sprite).refreshBody();

    // Plataformas de metal
    this.platforms = this.physics.add.staticGroup();
    [[300, 500], [640, 395], [950, 490]].forEach(([x, y]) => {
      (this.platforms.create(x, y, 'phase3-platform') as Phaser.Physics.Arcade.Sprite).refreshBody();
    });

    this.buildPanel();
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    // Sandy: pés no chão (height-50), corpo até y+70 → centro em height-120
    this.sandy = new SandyBochechas(this, 1020, height - 120);
    return this.sandy;
  }

  protected getDialog(): DialogConfig {
    return DIALOG_SANDY;
  }

  protected getNextSceneKey(): string {
    return 'DemoEndScene';
  }

  protected getBossProjectileTextureKey(): string {
    return 'sandy-laser';
  }

  protected getBossBarColor(): number {
    return 0xffcc80;
  }

  // GDD: A = respeitosa (telegrafada, generosa), B = competitiva (rápida e perigosa)
  protected applyMood(optionKey: 'A' | 'B'): void {
    this.sandy.setMood(optionKey === 'A' ? 'respeitosa' : 'competitiva');
  }

  protected onArenaCreate(): void {
    this.robots = [];
    this.panelHp = CONSTANTS.PANEL_HP;
    this.panelDestroyed = false;
    this.schedulePanelCycle();
  }

  protected onArenaUpdate(time: number): void {
    this.updateRobots(time);
    this.checkLaserPanelOverlap();

    // Sandy pede um novo Robô de Teste quando o cooldown vence
    if (this.sandy.tryRequestRobot(time)) this.spawnRobot(time);
  }

  protected onBossFinalPhaseHook(): void {
    const { width, height } = this.scale;
    const msg = this.add
      .text(width / 2, height / 2, 'Sandy ativou o protocolo de emergência!', {
        fontSize: '24px', color: '#FFCC80',
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
  }

  // ── Painel de controle ────────────────────────────────────────

  private buildPanel(): void {
    // Suporte + tela na parede do fundo
    this.add.rectangle(this.panelX, this.panelY + 48, 14, 36, 0x546e7a).setDepth(1);
    this.panelBody = this.add
      .rectangle(this.panelX, this.panelY, 70, 80, 0x37474f)
      .setStrokeStyle(2, 0x78909c)
      .setDepth(1);
    this.panelLight = this.add.arc(this.panelX, this.panelY - 14, 10, 0, 360, false, 0xb71c1c).setDepth(2);
    this.add
      .text(this.panelX, this.panelY + 56, 'PAINEL', { fontSize: '10px', color: '#78909C' })
      .setOrigin(0.5)
      .setDepth(1);
  }

  private schedulePanelCycle(): void {
    this.panelCycleTimer?.remove();
    this.panelCycleTimer = this.time.addEvent({
      delay: CONSTANTS.PANEL_CYCLE_MS,
      loop: true,
      callback: this.runPanelBoost,
      callbackScope: this,
    });
  }

  // GDD: quando acende verde, Sandy ganha bônus de velocidade
  private runPanelBoost(): void {
    if (this.panelDestroyed || this.isGameOver) return;

    // Aviso: pisca amarelo antes de ativar
    this.panelLight.setFillStyle(0xffd54f);
    this.tweens.add({ targets: this.panelLight, alpha: 0.3, duration: 130, yoyo: true, repeat: 2 });

    this.time.delayedCall(800, () => {
      if (this.panelDestroyed || this.isGameOver) return;
      this.panelLight.setFillStyle(0x00e676).setAlpha(1);
      this.sandy.setBoost(true);

      this.time.delayedCall(CONSTANTS.PANEL_SPEED_BOOST_DURATION, () => {
        this.sandy.setBoost(false);
        if (!this.panelDestroyed) this.panelLight.setFillStyle(0xb71c1c).setAlpha(1);
      });
    });
  }

  private checkLaserPanelOverlap(): void {
    if (this.panelDestroyed) return;
    const panelRect = new Phaser.Geom.Rectangle(this.panelX - 35, this.panelY - 40, 70, 80);

    this.plankton.getProjectileGroup().getChildren().forEach((obj) => {
      const laser = obj as Phaser.Physics.Arcade.Sprite;
      if (!laser.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(laser.getBounds(), panelRect)) {
        laser.setActive(false).setVisible(false);
        (laser.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.panelHp -= CONSTANTS.PLANKTON_LASER_DAMAGE;
        this.panelBody.setFillStyle(0x4e342e);
        this.time.delayedCall(60, () => {
          if (!this.panelDestroyed) this.panelBody.setFillStyle(0x37474f);
        });
        if (this.panelHp <= 0) this.destroyPanel();
      }
    });
  }

  // GDD: destruir o painel cancela o bônus, mas Sandy antecipa a fase final
  private destroyPanel(): void {
    this.panelDestroyed = true;
    this.panelCycleTimer?.remove();
    this.sandy.setBoost(false);

    this.panelLight.setFillStyle(0x424242);
    this.panelBody.setFillStyle(0x212121);
    this.cameras.main.shake(150, 0.006);

    const blast = this.add.ellipse(this.panelX, this.panelY, 90, 90, 0xffab40, 0.7).setDepth(6);
    this.tweens.add({
      targets: blast, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 350,
      onComplete: () => blast.destroy(),
    });

    this.sandy.forceFinalPhase();
  }

  // ── Robô de Teste ─────────────────────────────────────────────

  private spawnRobot(time: number): void {
    const sprite = this.physics.add.sprite(this.sandy.x - 90, this.sandy.y, 'sandy-robot');
    sprite.setDepth(5);
    this.physics.add.collider(sprite, this.ground);
    this.physics.add.collider(sprite, this.platforms);

    this.robots.push({
      sprite,
      hp: CONSTANTS.SANDY_ROBOT_HP,
      expireAt: time + CONSTANTS.SANDY_ROBOT_DURATION_MS,
      lastPushAt: 0,
    });
  }

  private updateRobots(time: number): void {
    if (this.robots.length === 0) return;

    // Lasers do Plankton: dois acertos destroem o robô (GDD)
    this.plankton.getProjectileGroup().getChildren().forEach((obj) => {
      const laser = obj as Phaser.Physics.Arcade.Sprite;
      if (!laser.active) return;
      for (const robot of this.robots) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(laser.getBounds(), robot.sprite.getBounds())) {
          laser.setActive(false).setVisible(false);
          (laser.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
          robot.hp -= CONSTANTS.PLANKTON_LASER_DAMAGE;
          this.skillCharge.addFromDamage(CONSTANTS.PLANKTON_LASER_DAMAGE);
          robot.sprite.setTint(0xff8a80);
          this.time.delayedCall(60, () => robot.sprite.clearTint());
          break;
        }
      }
    });

    this.robots = this.robots.filter((robot) => {
      // Destruído ou tempo de perseguição esgotado (GDD: 3 segundos)
      if (robot.hp <= 0 || time >= robot.expireAt) {
        this.poofRobot(robot);
        return false;
      }

      // Perseguição
      const dir = Math.sign(this.plankton.x - robot.sprite.x) || 1;
      robot.sprite.setVelocityX(dir * CONSTANTS.SANDY_ROBOT_SPEED);
      robot.sprite.setFlipX(dir < 0);

      // GDD: empurra para fora da área segura sem causar dano direto
      if (
        time - robot.lastPushAt > 500 &&
        Phaser.Geom.Intersects.RectangleToRectangle(robot.sprite.getBounds(), this.plankton.getBounds())
      ) {
        robot.lastPushAt = time;
        const push = Math.sign(this.plankton.x - robot.sprite.x) || 1;
        (this.plankton.body as Phaser.Physics.Arcade.Body).setVelocity(push * 460, -200);
      }

      return true;
    });
  }

  private poofRobot(robot: TestRobot): void {
    const { x, y } = robot.sprite;
    robot.sprite.destroy();
    const poof = this.add.ellipse(x, y, 60, 60, 0xb0bec5, 0.6).setDepth(6);
    this.tweens.add({
      targets: poof, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 280,
      onComplete: () => poof.destroy(),
    });
  }

  // ── Plantas texanas ───────────────────────────────────────────

  private buildCactus(x: number, groundTop: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x66bb6a, 1);
    g.fillRoundedRect(x - 9, groundTop - 70, 18, 70, 8);
    g.fillRoundedRect(x - 32, groundTop - 52, 26, 12, 6);
    g.fillRoundedRect(x - 32, groundTop - 52, 12, 28, 6);
    g.fillRoundedRect(x + 6, groundTop - 40, 26, 12, 6);
    g.fillRoundedRect(x + 20, groundTop - 62, 12, 34, 6);
  }

  // ── Texturas próprias da arena ────────────────────────────────

  private buildTextures(): void {
    const makeRect = (key: string, color: number, w: number, h: number) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    makeRect('phase3-ground', 0x8d7355, CONSTANTS.GAME_WIDTH, 50);

    if (!this.textures.exists('phase3-platform')) {
      const g = this.add.graphics();
      g.fillStyle(0x78909c, 1);
      g.fillRect(0, 0, 200, 20);
      g.fillStyle(0x546e7a, 1);
      g.fillRect(0, 0, 200, 4);
      [20, 70, 120, 170].forEach((x) => g.fillCircle(x + 5, 12, 2.5)); // rebites
      g.generateTexture('phase3-platform', 200, 20);
      g.destroy();
    }

    // Laser de laboratório: feixe vermelho com núcleo claro
    if (!this.textures.exists('sandy-laser')) {
      const g = this.add.graphics();
      g.fillStyle(0xff5252, 1);
      g.fillRect(0, 0, 46, 8);
      g.fillStyle(0xffcdd2, 1);
      g.fillRect(0, 3, 46, 2);
      g.generateTexture('sandy-laser', 46, 8);
      g.destroy();
    }

    // Granada de gelo
    if (!this.textures.exists('ice-grenade')) {
      const g = this.add.graphics();
      g.fillStyle(0x81d4fa, 1);
      g.fillCircle(9, 9, 9);
      g.fillStyle(0xe1f5fe, 1);
      g.fillCircle(6, 6, 3);
      g.generateTexture('ice-grenade', 18, 18);
      g.destroy();
    }

    // Robô de teste: caixa com olho e esteiras
    if (!this.textures.exists('sandy-robot')) {
      const g = this.add.graphics();
      g.fillStyle(0x90a4ae, 1);
      g.fillRoundedRect(0, 0, 36, 24, 5);
      g.fillStyle(0x37474f, 1);
      g.fillRect(0, 24, 36, 8);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(26, 10, 5);
      g.generateTexture('sandy-robot', 36, 32);
      g.destroy();
    }
  }
}
