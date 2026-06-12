import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { SandyBochechas } from '../../entities/bosses/SandyBochechas';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_SANDY } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';
import {
  ATTACK_PALETTES,
  COLORS_CSS,
  caption,
  display,
  impactBurst,
  makeGlowCapsule,
  makeGlowTexture,
} from '../../config/theme';
import type { AttackPalette } from '../../config/theme';

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

    this.add.image(width / 2, height / 2, 'bg-sandy');

    this.add
      .text(16, 16, '◆ CÚPULA SUBMARINA', caption(12, COLORS_CSS.text))
      .setShadow(1, 1, '#000000', 2);

    // Chão de terra da cúpula
    this.ground = this.physics.add.staticGroup();
    // Invisível: o gramado da imagem faz o papel de piso
    const ground = this.ground.create(width / 2, height - 25, 'phase3-ground') as Phaser.Physics.Arcade.Sprite;
    ground.refreshBody();
    ground.setVisible(false);

    // Plataformas de metal — one-way, em escada alcançável (degraus ≤125px)
    this.platforms = this.physics.add.staticGroup();
    [[300, 555], [640, 450], [950, 555]].forEach(([x, y]) => {
      this.addOneWayPlatform(x, y, 'phase3-platform');
    });

    this.buildPanel();
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    // Sandy: pés no chão (height-50), corpo até y+70 → centro em height-120
    this.sandy = new SandyBochechas(this, 1020, height - 134);
    return this.sandy;
  }

  protected getDialog(): DialogConfig {
    return DIALOG_SANDY;
  }

  protected getNextSceneKey(): string {
    return 'Phase4Scene';
  }

  protected getBossProjectileTextureKey(): string {
    return 'sandy-laser';
  }

  protected getBossBarColor(): number {
    // Vermelho dos lasers — o pêssego anterior não conversava com os ataques
    return ATTACK_PALETTES.sandy.mid;
  }

  protected getBossPalette(): AttackPalette {
    return ATTACK_PALETTES.sandy;
  }

  protected getBossName(): string {
    return 'SANDY BOCHECHAS';
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
      .text(width / 2, height / 2, 'Sandy ativou o protocolo de emergência!', display(24, '#ff5252'))
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0.6);
    this.tweens.add({ targets: msg, scale: 1, duration: 250, ease: 'Back.easeOut' });
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

    const blast = this.add
      .ellipse(this.panelX, this.panelY, 90, 90, 0xffab40, 0.7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(6);
    this.tweens.add({
      targets: blast, alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 350,
      onComplete: () => blast.destroy(),
    });
    impactBurst(this, this.panelX, this.panelY, { core: 0xffffff, mid: 0xffab40, halo: 0xe65100 }, {
      particles: 14,
      scale: 1.4,
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
    impactBurst(this, x, y, { core: 0xffffff, mid: 0x90a4ae, halo: 0x37474f }, {
      particles: 6,
      scale: 0.8,
    });
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

    // Placa de laboratório: metal escovado, faixas de alerta nas pontas,
    // linha de neon cyan no topo e rebites — tech da cúpula da Sandy
    if (!this.textures.exists('phase3-platform')) {
      const w = 230;
      const h = 26;
      const g = this.add.graphics();

      // Placa principal com sombra inferior
      g.fillStyle(0x78909c, 1);
      g.fillRoundedRect(0, 3, w, h - 3, 5);
      g.fillStyle(0x546e7a, 1);
      g.fillRoundedRect(0, h - 7, w, 7, { tl: 0, tr: 0, bl: 5, br: 5 });

      // Faixas de alerta diagonais nas pontas
      g.fillStyle(0xffd400, 1);
      g.fillRect(4, 6, 30, 14);
      g.fillRect(w - 34, 6, 30, 14);
      g.fillStyle(0x263238, 1);
      [0, 1, 2].forEach((i) => {
        g.fillRect(8 + i * 10, 6, 5, 14);
        g.fillRect(w - 30 + i * 10, 6, 5, 14);
      });

      // Linha de neon no topo — superfície pisável bem legível
      g.fillStyle(0x4dd0e1, 0.95);
      g.fillRoundedRect(0, 0, w, 4, { tl: 5, tr: 5, bl: 0, br: 0 });

      // Rebites
      g.fillStyle(0x37474f, 1);
      [50, 90, 140, 180].forEach((x) => g.fillCircle(x, 14, 2.5));

      g.generateTexture('phase3-platform', w, h);
      g.destroy();
    }

    // Laser de laboratório: cápsula com glow assado (core branco / halo rubro)
    makeGlowCapsule(this, 'sandy-laser', ATTACK_PALETTES.sandy, 46, 12);

    // Granada de gelo: glow branco-gélido
    makeGlowTexture(this, 'ice-grenade', ATTACK_PALETTES.ice, 11);

    // Robô de teste: caixa com olho e esteiras
    if (!this.textures.exists('sandy-robot')) {
      const g = this.add.graphics();
      g.fillStyle(0x90a4ae, 1);
      g.fillRoundedRect(0, 0, 36, 24, 5);
      g.fillStyle(0x37474f, 1);
      g.fillRect(0, 24, 36, 8);
      // Olho com brilho de alerta
      g.fillStyle(0xff1744, 0.4);
      g.fillCircle(26, 10, 7);
      g.fillStyle(0xff1744, 1);
      g.fillCircle(26, 10, 5);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(27, 9, 2);
      g.generateTexture('sandy-robot', 36, 32);
      g.destroy();
    }
  }
}
