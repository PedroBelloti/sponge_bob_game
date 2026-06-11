import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { Bob } from '../../entities/bosses/Bob';
import { Gary } from '../../entities/bosses/Gary';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { DIALOG_BOB } from '../../data/dialogs';
import { BossPhaseScene } from './BossPhaseScene';
import {
  ATTACK_PALETTES,
  COLORS_CSS,
  caption,
  display,
  impactBurst,
  makeGlowTexture,
} from '../../config/theme';
import type { AttackPalette } from '../../config/theme';

export class Phase4Scene extends BossPhaseScene {
  private bob!: Bob;
  private gary!: Gary;
  private slimes!: Phaser.Physics.Arcade.Group;

  // Vigas do teto (GDD)
  private vigasGroup!: Phaser.Physics.Arcade.Group;
  private vigaTimer: Phaser.Time.TimerEvent | null = null;
  private currentVigaInterval: number = CONSTANTS.VIGA_FALL_INTERVAL;

  // Gary roll state
  private lastGaryRollTime: number = 0;

  constructor() {
    super({ key: 'Phase4Scene' });
  }

  // ── BossPhaseScene impl ───────────────────────────────────────

  protected buildArena(width: number, height: number): void {
    this.buildTextures();

    // Siri Cascudo Destruído
    this.add.image(width / 2, height / 2, 'bg-bob');

    this.add
      .text(16, 16, '◆ RUÍNAS DO SIRI CASCUDO', caption(12, COLORS_CSS.text))
      .setShadow(1, 1, '#000000', 2);

    // Ajustar limites do mundo para permitir queda livre no fundo
    this.physics.world.setBounds(0, 0, width, height + 100);

    // Chão destruído com buracos (GDD)
    this.ground = this.physics.add.staticGroup();
    
    // Segmento 1: Esquerda
    const g1 = this.ground.create(190, height - 25, 'phase4-ground') as Phaser.Physics.Arcade.Sprite;
    g1.setDisplaySize(380, 50).refreshBody();
    
    // Segmento 2: Centro
    const g2 = this.ground.create(720, height - 25, 'phase4-ground') as Phaser.Physics.Arcade.Sprite;
    g2.setDisplaySize(400, 50).refreshBody();
    
    // Segmento 3: Direita
    const g3 = this.ground.create(1165, height - 25, 'phase4-ground') as Phaser.Physics.Arcade.Sprite;
    g3.setDisplaySize(230, 50).refreshBody();

    // Plataformas iniciais (vigas já caídas) — one-way
    this.platforms = this.physics.add.staticGroup();
    this.addOneWayPlatform(300, 550, 'phase4-platform');
    this.addOneWayPlatform(980, 550, 'phase4-platform');
    this.addOneWayPlatform(640, 430, 'phase4-platform');

    // Fogo residual nos cantos da tela (GDD)
    this.createResidualFires(height);
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    this.bob = new Bob(this, 1100, height - 120);
    return this.bob;
  }

  protected getDialog(): DialogConfig {
    return DIALOG_BOB;
  }

  protected getNextSceneKey(): string {
    return 'SkillSelectScene';
  }

  protected getBossProjectileTextureKey(): string {
    return 'hamburger';
  }

  protected getBossBarColor(): number {
    return ATTACK_PALETTES.bobBoss.mid;
  }

  protected getBossPalette(): AttackPalette {
    return ATTACK_PALETTES.bobBoss;
  }

  protected getBossName(): string {
    return 'BOB ESPONJA';
  }

  protected applyMood(optionKey: 'A' | 'B'): void {
    this.bob.setMood(optionKey === 'A' ? 'triste' : 'determinado');
  }

  protected onArenaCreate(): void {
    this.lastGaryRollTime = 0;
    this.currentVigaInterval = CONSTANTS.VIGA_FALL_INTERVAL;

    // Grupo de slimes (gosma do Gary)
    this.slimes = this.physics.add.group();

    // Gary lesma
    this.gary = new Gary(this, 0, 0, this.slimes);

    // Grupo de vigas caindo
    this.vigasGroup = this.physics.add.group();

    // Colisão Vigas -> Ground & Platforms para virar plataforma
    this.physics.add.collider(this.vigasGroup, this.ground, (v) => {
      this.solidifyViga(v as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.collider(this.vigasGroup, this.platforms, (v) => {
      this.solidifyViga(v as Phaser.Physics.Arcade.Sprite);
    });

    // Colisão Vigas -> Plankton (dano enquanto cai)
    this.physics.add.overlap(this.plankton, this.vigasGroup, (_, v) => {
      const viga = v as Phaser.Physics.Arcade.Sprite;
      if (!viga.getData('solid')) {
        if (this.plankton.receiveDamage(1)) {
          this.updateHUD();
        }
        viga.destroy();
      }
    });

    // Colisão Gary -> Plankton
    this.physics.add.overlap(this.plankton, this.gary, () => {
      if (this.gary.isRollingActive() && this.plankton.receiveDamage(1)) {
        const pushDir = Math.sign(this.plankton.x - this.gary.x) || 1;
        (this.plankton.body as Phaser.Physics.Arcade.Body).setVelocity(pushDir * 420, -180);
        this.updateHUD();
      }
    });

    // Agendar queda de vigas
    this.scheduleVigaTimer();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.physics && this.physics.world) {
        this.physics.world.setBounds(0, 0, CONSTANTS.GAME_WIDTH, CONSTANTS.GAME_HEIGHT);
      }
      this.vigaTimer?.remove();
      if (this.gary) {
        this.gary.stopAttack();
      }
    });
  }

  protected onArenaUpdate(time: number): void {
    // Verificar queda do jogador nos buracos
    if (this.plankton.y > CONSTANTS.GAME_HEIGHT + 30 && !this.isGameOver) {
      this.plankton.receiveDamage(CONSTANTS.PLANKTON_MAX_HP);
      this.updateHUD();
    }

    // Verificar se jogador está pisando no rastro de gosma (torna escorregadio)
    let onSlime = false;
    this.slimes.getChildren().forEach((s) => {
      const slime = s as Phaser.Physics.Arcade.Sprite;
      if (
        slime.active &&
        slime.visible &&
        Phaser.Geom.Intersects.RectangleToRectangle(this.plankton.getBounds(), slime.getBounds())
      ) {
        onSlime = true;
      }
    });
    this.plankton.setSlippery(onSlime);

    // Atualizar Gary
    if (this.gary.active) {
      this.gary.update();
    }

    // Spawna Gary abaixo de 50% HP (GDD)
    const hpPct = this.bob.getHpPercent();
    if (hpPct <= 0.5 && !this.gary.isRollingActive()) {
      const isDetermined = this.bob.getMood() === 'determinado';
      const cooldown = isDetermined ? 9000 : 14000;
      if (this.lastGaryRollTime === 0 || time - this.lastGaryRollTime >= cooldown) {
        this.lastGaryRollTime = time;
        const fromLeft = this.plankton.x > this.scale.width / 2;
        const speed = isDetermined ? 450 : 300;
        this.gary.startAttack(fromLeft, speed);
      }
    }
  }

  protected onBossFinalPhaseHook(): void {
    // Fase final abaixo de 25% HP: vigas caem mais rápido (GDD)
    this.currentVigaInterval = 2000;
    this.scheduleVigaTimer();

    const { width, height } = this.scale;
    const msg = this.add
      .text(width / 2, height / 2, 'Teto desmoronando! Cuidado!', display(24, '#ffb300'))
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0.6);
    this.tweens.add({ targets: msg, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
  }

  // ── Vigas caindo ──────────────────────────────────────────────

  private scheduleVigaTimer(): void {
    this.vigaTimer?.remove();
    this.vigaTimer = this.time.addEvent({
      delay: this.currentVigaInterval,
      loop: true,
      callback: this.triggerVigaFall,
      callbackScope: this,
    });
  }

  private triggerVigaFall(): void {
    if (this.isGameOver || this.bob.isBossDefeated()) return;

    const x = Phaser.Math.Between(100, 1180);

    // Linha vertical de alerta tracejada
    const warn = this.add.graphics().setDepth(4).setAlpha(0.2);
    warn.lineStyle(2, 0xffb300, 1);
    for (let y = 0; y < CONSTANTS.GAME_HEIGHT; y += 24) {
      warn.lineBetween(x, y, x, y + 12);
    }

    this.tweens.add({
      targets: warn,
      alpha: 0.75,
      duration: 220,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        warn.destroy();
        if (this.isGameOver || this.bob.isBossDefeated()) return;

        // Spawna viga
        const viga = this.vigasGroup.get(x, -30, 'viga') as Phaser.Physics.Arcade.Sprite | null;
        if (!viga) return;
        viga.setActive(true).setVisible(true);
        viga.setData('solid', false);
        viga.setAlpha(1);
        viga.setScale(1);
        viga.setAngle(0);

        const body = viga.body as Phaser.Physics.Arcade.Body;
        body.reset(x, -30);
        body.setAllowGravity(true);
        body.setVelocityY(280);
        body.setImmovable(false);

        // Resetar coliisões
        body.checkCollision.down = true;
        body.checkCollision.left = true;
        body.checkCollision.right = true;
        body.checkCollision.up = true;
      },
    });
  }

  private solidifyViga(viga: Phaser.Physics.Arcade.Sprite): void {
    if (viga.getData('solid')) return;
    viga.setData('solid', true);

    const body = viga.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Torna plataforma one-way
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;

    // Adiciona ao grupo de plataformas para o Plankton subir
    this.platforms.add(viga);

    // Efeito visual de poeira no pouso
    impactBurst(this, viga.x, viga.y + 10, { core: 0xffffff, mid: 0xaed581, halo: 0x558b2f }, {
      particles: 6,
      scale: 0.8,
    });

    // Piscar e sumir depois de 7 segundos (GDD)
    this.time.delayedCall(7000, () => {
      this.tweens.add({
        targets: viga,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          this.platforms.remove(viga);
          viga.destroy();
        },
      });
    });
  }

  // ── Efeito visual de fogo ─────────────────────────────────────

  private createResidualFires(height: number): void {
    const fireXList = [40, 1240];
    fireXList.forEach((x) => {
      const f = this.add.particles(x, height - 50, 'fx-dot', {
        speedY: { min: -100, max: -40 },
        speedX: { min: -20, max: 20 },
        lifespan: { min: 400, max: 800 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xff3d00, 0xff9100, 0xffea00],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 80,
      });
      f.setDepth(1);
    });
  }

  // ── Texturas e carregamento dinâmico ──────────────────────────

  private buildTextures(): void {
    // Chão de metal queimado do Siri Cascudo
    if (!this.textures.exists('phase4-ground')) {
      const w = 400;
      const h = 50;
      const g = this.add.graphics();
      // Base cinza escuro chamuscado
      g.fillStyle(0x212121, 1);
      g.fillRect(0, 0, w, h);
      // Linha superior neon âmbar legível
      g.fillStyle(0xffb300, 0.95);
      g.fillRect(0, 0, w, 4);
      // Rachaduras de fogo residual
      g.fillStyle(0xd84315, 0.6);
      g.fillRect(50, 10, 4, 30);
      g.fillRect(150, 20, 5, 20);
      g.fillRect(300, 15, 4, 25);
      g.generateTexture('phase4-ground', w, h);
      g.destroy();
    }

    // Plataforma: viga caida destruída
    if (!this.textures.exists('phase4-platform')) {
      const w = 240;
      const h = 26;
      const g = this.add.graphics();
      g.fillStyle(0x424242, 1);
      g.fillRoundedRect(0, 3, w, h - 3, 5);
      g.fillStyle(0x1a1a1a, 1);
      g.fillRoundedRect(0, h - 7, w, 7, { tl: 0, tr: 0, bl: 5, br: 5 });
      g.fillStyle(0xffb300, 0.95); // Topo neon ambar
      g.fillRoundedRect(0, 0, w, 4, { tl: 5, tr: 5, bl: 0, br: 0 });
      g.generateTexture('phase4-platform', w, h);
      g.destroy();
    }

    // Projétil Hambúrguer
    if (!this.textures.exists('hamburger')) {
      const g = this.add.graphics();
      // Bun top (laranja-escura/marrom)
      g.fillStyle(0xd84315, 1);
      g.fillRoundedRect(4, 2, 24, 8, { tl: 5, tr: 5, bl: 1, br: 1 });
      // Lettuce (verde)
      g.fillStyle(0x4caf50, 1);
      g.fillRect(3, 10, 26, 2);
      // Cheese (amarelo)
      g.fillStyle(0xffd54f, 1);
      g.fillRect(4, 12, 24, 2);
      // Patty (marrom)
      g.fillStyle(0x4e342e, 1);
      g.fillRoundedRect(3, 14, 26, 6, 2);
      // Bun bottom (laranja-escura/marrom)
      g.fillStyle(0xd84315, 1);
      g.fillRoundedRect(4, 20, 24, 4, { tl: 1, tr: 1, bl: 3, br: 3 });
      
      // Sementes de gergelim no topo
      g.fillStyle(0xffe082, 1);
      g.fillCircle(10, 5, 1);
      g.fillCircle(16, 4, 1);
      g.fillCircle(22, 6, 1);

      g.generateTexture('hamburger', 32, 26);
      g.destroy();
    }

    // Viga caindo
    if (!this.textures.exists('viga')) {
      const w = 160;
      const h = 24;
      const g = this.add.graphics();
      g.fillStyle(0x78909c, 1);
      g.fillRect(0, 0, w, h);
      g.fillStyle(0x8d6e63, 0.7);
      g.fillRect(15, 4, 30, 6);
      g.fillRect(100, 14, 40, 6);
      g.fillStyle(0xffb300, 0.95); // Linha ambar topo
      g.fillRect(0, 0, w, 3);
      g.generateTexture('viga', w, h);
      g.destroy();
    }

    // Projétil returned (bolha azul)
    if (!this.textures.exists('bob-projectile')) {
      makeGlowTexture(this, 'bob-projectile', ATTACK_PALETTES.bob, 12);
    }
  }
}
