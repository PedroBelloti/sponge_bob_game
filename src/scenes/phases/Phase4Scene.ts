import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { Bob } from '../../entities/bosses/Bob';
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

  // Vigas do teto (GDD)
  private vigasGroup!: Phaser.Physics.Arcade.Group;
  private vigaTimer: Phaser.Time.TimerEvent | null = null;
  private currentVigaInterval: number = CONSTANTS.VIGA_FALL_INTERVAL;

  // Onda de águas-vivas (substitui o Gary) — choque sem dano que trava o player
  private jellyfish!: Phaser.Physics.Arcade.Group;
  private lastJellyWaveTime: number = 0;

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
    return 'bob-bubble';
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
    this.lastJellyWaveTime = 0;
    this.currentVigaInterval = CONSTANTS.VIGA_FALL_INTERVAL;

    // Grupo de águas-vivas (onda que dá choque)
    this.jellyfish = this.physics.add.group();

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

    // Agendar queda de vigas
    this.scheduleVigaTimer();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.physics && this.physics.world) {
        this.physics.world.setBounds(0, 0, CONSTANTS.GAME_WIDTH, CONSTANTS.GAME_HEIGHT);
      }
      this.vigaTimer?.remove();
    });
  }

  protected onArenaUpdate(time: number): void {
    // Verificar queda do jogador nos buracos
    if (this.plankton.y > CONSTANTS.GAME_HEIGHT + 30 && !this.isGameOver) {
      this.plankton.receiveDamage(CONSTANTS.PLANKTON_MAX_HP);
      this.updateHUD();
    }

    // Onda de águas-vivas: movimento + choque ao tocar o Plankton
    this.updateJellyfish();

    // Lança ondas abaixo de 50% HP do Bob (no lugar do Gary)
    const hpPct = this.bob.getHpPercent();
    if (hpPct <= 0.5) {
      const isDetermined = this.bob.getMood() === 'determinado';
      const cooldown = isDetermined ? 4500 : 6500;
      if (this.lastJellyWaveTime === 0 || time - this.lastJellyWaveTime >= cooldown) {
        this.lastJellyWaveTime = time;
        this.spawnJellyfishWave(Math.random() < 0.5);
      }
    }
  }

  // ── Onda de águas-vivas (substitui o Gary) ────────────────────

  private spawnJellyfishWave(fromLeft: boolean): void {
    const { width } = this.scale;
    const speed = (this.bob.getMood() === 'determinado' ? 230 : 185);
    const startX = fromLeft ? -40 : width + 40;
    const vx = fromLeft ? speed : -speed;

    // Linha vertical de águas-vivas com 2 lacunas seguidas p/ desviar
    const ys = [120, 200, 280, 360, 440, 520, 600];
    const gap = Phaser.Math.Between(0, ys.length - 2);
    ys.forEach((y, i) => {
      if (i === gap || i === gap + 1) return; // brecha para passar
      const jelly = this.jellyfish.create(startX, y, 'jellyfish') as Phaser.Physics.Arcade.Sprite;
      jelly.setDepth(4);
      const body = jelly.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setVelocityX(vx);
    });
  }

  private updateJellyfish(): void {
    const { width } = this.scale;
    this.jellyfish.getChildren().forEach((o) => {
      const j = o as Phaser.Physics.Arcade.Sprite;
      if (!j.active) return;
      if (j.x < -60 || j.x > width + 60) { j.destroy(); return; }
      if (Phaser.Geom.Intersects.RectangleToRectangle(j.getBounds(), this.plankton.getBounds())) {
        this.shockPlayer(j.x, j.y);
        j.destroy();
      }
    });
  }

  /** Choque: trava o Plankton (sem dano). No ar ele despenca; sobre buraco, morre. */
  private shockPlayer(x: number, y: number): void {
    this.plankton.applyFreezeEffect(800);
    impactBurst(this, x, y, { core: 0xffffff, mid: 0xff80ab, halo: 0xf06292 }, { particles: 8, scale: 1 });
    this.cameras.main.shake(120, 0.004);
  }

  protected onBossFinalPhaseHook(): void {
    // Fase final abaixo de 25% HP: vigas caem um pouco mais rápido
    this.currentVigaInterval = 3500;
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

    // Viga caindo — tábua de madeira
    if (!this.textures.exists('viga')) {
      const w = 160;
      const h = 24;
      const g = this.add.graphics();
      // corpo de madeira
      g.fillStyle(0x8d5a2b, 1);
      g.fillRect(0, 0, w, h);
      // brilho de luz no topo
      g.fillStyle(0xb07a45, 0.6);
      g.fillRect(0, 1, w, 2);
      // veios do grão (linhas escuras horizontais)
      g.fillStyle(0x5d3a1a, 0.8);
      g.fillRect(0, 6, w, 2);
      g.fillRect(0, 13, w, 2);
      g.fillStyle(0x5d3a1a, 0.5);
      g.fillRect(0, 19, w, 1.5);
      // nós da madeira (knots)
      g.fillStyle(0x4e2e15, 0.9);
      g.fillCircle(40, 12, 4);
      g.fillCircle(112, 9, 3.5);
      // tampas das pontas, mais escuras (corte da tábua)
      g.fillStyle(0x6b4423, 1);
      g.fillRect(0, 0, 5, h);
      g.fillRect(w - 5, 0, 5, h);
      g.generateTexture('viga', w, h);
      g.destroy();
    }

    // Projétil returned (bolha azul)
    if (!this.textures.exists('bob-projectile')) {
      makeGlowTexture(this, 'bob-projectile', ATTACK_PALETTES.bob, 12);
    }

    // Água-viva: sino rosa translúcido + tentáculos
    if (!this.textures.exists('jellyfish')) {
      const g = this.add.graphics();
      g.fillStyle(0xf06292, 0.35); g.fillEllipse(22, 18, 42, 30); // halo
      g.fillStyle(0xff80ab, 0.7);  g.fillEllipse(22, 17, 34, 24); // sino
      g.fillStyle(0xf48fb1, 0.9);  g.fillEllipse(22, 15, 26, 18);
      g.fillStyle(0xffffff, 0.55); g.fillEllipse(15, 11, 9, 5);   // brilho
      g.lineStyle(3, 0xf06292, 0.8);
      [10, 17, 24, 31].forEach((tx, i) => {
        g.beginPath();
        g.moveTo(tx, 27);
        g.lineTo(tx + (i % 2 ? 5 : -5), 47);
        g.strokePath();
      });
      g.generateTexture('jellyfish', 44, 50);
      g.destroy();
    }
  }
}
