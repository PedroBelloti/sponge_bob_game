import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { EventBus } from '../../core/EventBus';
import type { BossId } from '../../core/EventBus';
import { Plankton } from '../../entities/Plankton';
import type { WASDKeys } from '../../entities/PlayerBase';
import type { BaseBoss, ProjectileData, BossPerch } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { GameState } from '../../state/GameState';
import { SkillCharge } from '../../systems/SkillCharge';
import {
  ATTACK_PALETTES,
  COLORS,
  COLORS_CSS,
  caption,
  display,
  fadeInScene,
  fadeToScene,
  impactBurst,
  makeGlowTexture,
  makeParticleDot,
  mono,
  tweenBarTo,
} from '../../config/theme';
import type { AttackPalette } from '../../config/theme';

/**
 * Esqueleto comum de toda luta de boss: Plankton + controles, HUD,
 * pool de projéteis do boss, Habilidade Suprema, diálogo com escolha,
 * game over/retry e vitória. Subclasses fornecem arena, boss e mood.
 */
export abstract class BossPhaseScene extends Phaser.Scene {
  protected plankton!: Plankton;
  protected boss!: BaseBoss;
  protected ground!: Phaser.Physics.Arcade.StaticGroup;
  protected platforms!: Phaser.Physics.Arcade.StaticGroup;
  protected isGameOver: boolean = false;
  protected skillCharge!: SkillCharge;
  protected autoCastSupreme = false; // boss final ativa a suprema sozinho

  private wasd!: WASDKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private skillKey!: Phaser.Input.Keyboard.Key;

  protected bossProjectilePool!: Phaser.Physics.Arcade.Group;
  private surfWave: Phaser.GameObjects.Container | null = null;
  private surfWaveHitBoss = false;
  private bossHpFill!: Phaser.GameObjects.Rectangle;
  private bossHpChip!: Phaser.GameObjects.Rectangle;

  private planktonHearts: Phaser.GameObjects.Image[] = [];
  private planktonHpLast: number = CONSTANTS.PLANKTON_MAX_HP;
  private lowHpPulse: Phaser.Tweens.Tween | null = null;
  private skillBarFill!: Phaser.GameObjects.Rectangle;
  private skillLabel!: Phaser.GameObjects.Text;
  private skillReadyPulse: Phaser.Tweens.Tween | null = null;
  private skillWasReady = false;

  // Trail compartilhado por cor (frequency -1, emitParticleAt no cull loop) —
  // zero emitters por projétil, performance segura para pools
  private trailEmitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();

  // ── Contrato da subclasse ─────────────────────────────────────

  /** Visual da arena + this.ground e this.platforms preenchidos. */
  protected abstract buildArena(width: number, height: number): void;
  protected abstract createBoss(width: number, height: number): BaseBoss;
  protected abstract getDialog(): DialogConfig;
  protected abstract getNextSceneKey(): string;
  protected abstract getBossProjectileTextureKey(): string;
  protected abstract getBossBarColor(): number;
  /** Paleta de glow dos ataques do boss (trails, impactos, aura final). */
  protected abstract getBossPalette(): AttackPalette;
  /** Nome exibido sobre a barra de HP. */
  protected abstract getBossName(): string;

  /** Aplica o efeito da escolha de diálogo no boss (GDD). */
  protected applyMood(_optionKey: 'A' | 'B'): void {}
  /** Sistemas específicos da arena (algodão, holofote...). */
  protected onArenaCreate(): void {}
  protected onArenaUpdate(_time: number): void {}
  protected onBossFinalPhaseHook(): void {}
  protected getVictoryText(): string { return 'Fragmento recuperado!'; }
  protected getControlsHint(): string {
    return 'WASD Mover   ESPAÇO/W Pular   CLICK Atirar   SHIFT Dash   S Agachar   Q Suprema';
  }

  // ── Ciclo de vida ─────────────────────────────────────────────

  create(): void {
    const { width, height } = this.scale;

    fadeInScene(this);

    // Estado precisa resetar a cada (re)início da cena
    this.isGameOver = false;
    this.planktonHearts = [];
    this.planktonHpLast = CONSTANTS.PLANKTON_MAX_HP;
    this.skillCharge = new SkillCharge();
    this.skillReadyPulse = null;
    this.skillWasReady = false;
    this.lowHpPulse = null;
    this.trailEmitters = new Map();

    this.buildCommonTextures();
    this.buildArena(width, height);
    this.boss = this.createBoss(width, height);
    this.boss.setDepth(2);
    if (this.boss.usesGroundMovement()) {
      this.configureBossMovement(width, height);
    }
    this.buildBossHpBar(width);
    this.buildPlankton(height);
    this.bossProjectilePool = this.physics.add.group({
      maxSize: this.boss.getConfig().projectilePoolSize,
    });
    this.setupOverlaps();
    this.buildHUD(width);
    this.buildControlsHint(width, height);
    this.onArenaCreate();

    EventBus.on('boss:damaged',     this.onBossDamaged,    this);
    EventBus.on('boss:defeated',    this.onBossDefeated,   this);
    EventBus.on('boss:final-phase', this.onBossFinalPhase, this);
    EventBus.on('player:defeated',  this.onPlayerDefeated, this);

    // Phaser NÃO chama um método shutdown() automaticamente — sem isso os
    // listeners do EventBus duplicariam a cada restart (retry)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('boss:damaged',     this.onBossDamaged);
      EventBus.off('boss:defeated',    this.onBossDefeated);
      EventBus.off('boss:final-phase', this.onBossFinalPhase);
      EventBus.off('player:defeated',  this.onPlayerDefeated);
    });

    // Garante Plankton ativo ao retomar após pausa da DialogScene
    this.events.on('resume', () => {
      if (this.plankton) {
        this.plankton.setActive(true);
        this.plankton.setVisible(true);
      }
      this.applyChoiceMood();
    });

    // Diálogo com o boss antes da luta — só na primeira vez
    const sceneData = this.sys.settings.data as { bossDialogDone?: boolean } | undefined;
    if (!sceneData?.bossDialogDone) {
      this.scene.launch('DialogScene', this.getDialog());
      this.scene.bringToTop('DialogScene'); // renderiza acima desta cena
      this.scene.pause();
    } else {
      // Retry: escolha já registrada em tentativa anterior
      this.applyChoiceMood();
    }
  }

  update(time: number): void {
    if (this.isGameOver) return;

    this.plankton.update(this.wasd, this.spaceKey, this.dashKey, this.input.activePointer, time);

    // Boss decide quando e quais projéteis lançar
    const shots = this.boss.update(time, this.plankton.x, this.plankton.y);
    shots.forEach((data) => this.spawnBossProjectile(data));
    this.cullBossProjectiles(time);

    // Habilidade Suprema — manual [Q] ou auto (boss final ativa sozinho ao encher)
    const fireSupreme = Phaser.Input.Keyboard.JustDown(this.skillKey)
      || (this.autoCastSupreme && this.skillCharge.isReady());
    if (fireSupreme && this.skillCharge.consume()) {
      const skill = GameState.getInstance().getData().skillUnlocked;
      if (skill === 'bob') {
        this.castSurfWave();
      } else {
        this.castAnchors();
      }
    }

    // Update wave physics & collision
    const wave = this.surfWave;
    if (wave && wave.active) {
      const waveX = wave.x;
      const waveY = wave.y;
      const { width } = this.scale;

      if (this.time.now % 100 < 20) {
        this.cameras.main.shake(100, 0.002);
      }
      
      const dotTex = this.textures.exists('bubble-texture') ? 'bubble-texture' : makeParticleDot(this);
      const splash = this.add.particles(waveX - 40, waveY - 10, dotTex, {
        lifespan: 600,
        speedX: { min: -150, max: -50 },
        speedY: { min: -180, max: -80 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 0.6, end: 0 },
        tint: 0x4dd0e1,
        maxParticles: 3,
      });
      this.time.delayedCall(700, () => splash.destroy());

      // Overlap com o Boss
      if (!this.surfWaveHitBoss && !this.boss.isBossDefeated()) {
        const bossBounds = this.boss.getHitBounds();
        const waveRect = new Phaser.Geom.Rectangle(waveX - 100, waveY - 340, 200, 340);
        if (Phaser.Geom.Intersects.RectangleToRectangle(waveRect, bossBounds)) {
          this.surfWaveHitBoss = true;
          this.boss.receiveDamage(210); // Onda gigante — dano alto
          impactBurst(this, this.boss.x, this.boss.y, { core: 0xffffff, mid: 0x4dd0e1, halo: 0xffd400 }, {
            particles: 25,
            scale: 2.0,
            depth: 10,
          });
        }
      }

      // Overlap com Projéteis
      this.bossProjectilePool.getChildren().forEach((obj) => {
        const proj = obj as Phaser.Physics.Arcade.Sprite;
        if (proj.active) {
          const waveRect = new Phaser.Geom.Rectangle(waveX - 150, waveY - 470, 300, 470);
          if (Phaser.Geom.Intersects.RectangleToRectangle(waveRect, proj.getBounds())) {
            this.deactivateBossProjectile(proj);
            impactBurst(this, proj.x, proj.y, ATTACK_PALETTES.bob);
          }
        }
      });

      if (waveX > width + 180) {
        this.destroySurfWave();
      }
    }

    this.checkLaserBossOverlap();
    this.onArenaUpdate(time);
    this.updateHUD();
    this.updateSkillBar();
  }

  // ── GDD: a escolha do diálogo molda o comportamento do boss ──

  private applyChoiceMood(): void {
    const choices = GameState.getInstance().getData().choices;
    const choice = [...choices].reverse().find((c) => c.bossId === this.boss.getBossId());
    if (!choice) return;
    this.applyMood(choice.optionKey as 'A' | 'B');
  }

  // ── Plataformas ───────────────────────────────────────────────

  /**
   * Plataforma one-way: o jogador atravessa por baixo/pelos lados e pousa
   * por cima — sem "bater a cabeça" ao pular por baixo dela.
   */
  protected addOneWayPlatform(x: number, y: number, textureKey: string): void {
    const sprite = this.platforms.create(x, y, textureKey) as Phaser.Physics.Arcade.Sprite;
    sprite.refreshBody();
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  /**
   * Monta as poleiras do boss a partir dos corpos de física já criados:
   * o chão e as plataformas do lado direito da arena (mantém o boss à direita).
   * O `y` de cada poleira é o CENTRO do boss = topo da superfície − feetOffset.
   */
  private configureBossMovement(width: number, height: number): void {
    const foot = this.boss.getFeetOffset();
    const perches: BossPerch[] = [];

    // Chão (patrulha restrita ao terço direito p/ não invadir a área do player)
    const groundChild = this.ground.getChildren()[0] as Phaser.Physics.Arcade.Sprite | undefined;
    const groundTop = groundChild?.body ? (groundChild.body as Phaser.Physics.Arcade.StaticBody).top : height - 50;
    perches.push({ y: groundTop - foot, xMin: width * 0.6, xMax: width - 95 });

    // Plataformas do lado direito viram poleiras alcançáveis
    this.platforms.getChildren().forEach((obj) => {
      const s = obj as Phaser.Physics.Arcade.Sprite;
      const body = s.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!body || s.x < width * 0.52) return;
      const xMin = Math.min(body.left + 20, body.right - 5);
      const xMax = Math.max(body.right - 20, body.left + 5);
      perches.push({ y: body.top - foot, xMin, xMax });
    });

    this.boss.configureGroundMovement(perches, this.boss.x);
  }

  // ── Texturas comuns ───────────────────────────────────────────

  private buildCommonTextures(): void {
    if (!this.textures.exists('plankton-placeholder')) {
      const g = this.add.graphics();
      g.lineStyle(2, 0x2e7d32, 1);
      g.beginPath();
      g.moveTo(18, 12); g.lineTo(10, 2);
      g.moveTo(22, 12); g.lineTo(30, 2);
      g.strokePath();
      g.fillStyle(0x4caf50, 1); g.fillCircle(20, 24, 20);
      g.fillStyle(0xff1744, 1); g.fillCircle(20, 20, 8);
      g.fillStyle(0x000000, 1); g.fillCircle(22, 20, 4);
      g.generateTexture('plankton-placeholder', 40, 44);
      g.destroy();
    }

    if (!this.textures.exists('anchor')) {
      const g = this.add.graphics();
      g.fillStyle(0x1b3b1b, 1);
      g.fillRect(16, 0, 8, 56);            // haste
      g.fillRect(8, 4, 24, 6);             // travessa
      g.fillStyle(0x2e5d2e, 1);
      g.fillTriangle(0, 44, 20, 64, 20, 44);   // pata esquerda
      g.fillTriangle(40, 44, 20, 64, 20, 44);  // pata direita
      g.generateTexture('anchor', 40, 64);
      g.destroy();
    }
  }

  // ── Plankton + controles ──────────────────────────────────────

  private buildPlankton(height: number): void {
    this.plankton = new Plankton(this, 150, height - 50 - 60);
    this.physics.add.collider(this.plankton, this.ground);
    this.physics.add.collider(this.plankton, this.platforms);

    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as WASDKeys;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dashKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.skillKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.input.mouse?.disableContextMenu();
  }

  // ── Pool de projéteis do boss ─────────────────────────────────

  private spawnBossProjectile(data: ProjectileData): void {
    const key = data.textureKey ?? this.getBossProjectileTextureKey();
    const p = this.bossProjectilePool.get(data.x, data.y, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;
    p.setTexture(key); // pool reaproveita sprites — textura pode estar errada
    p.setActive(true).setVisible(true);
    p.setBlendMode(Phaser.BlendModes.ADD); // texturas têm glow assado
    p.setRotation(data.rotation ?? 0);     // pool reusa sprites — sempre resetar
    p.setData('damage', data.damage);
    p.setData('effect', data.effect ?? null);
    p.setData('trailTint', data.trailTint ?? this.getBossPalette().mid);
    p.setData('homeUntil', data.homingMs ? this.time.now + data.homingMs : 0);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.enable = true; // pool reusa sprites desativados — reabilita a física
    body.reset(data.x, data.y);
    body.setAllowGravity(data.gravity ?? false);
    body.setVelocity(data.velocityX, data.velocityY);

    if (data.bounce) {
      body.setCollideWorldBounds(true);
      body.setBounce(1, 1);
      p.setData('expireAt', this.time.now + (data.lifespanMs ?? 4000));
    } else {
      body.setCollideWorldBounds(false);
      body.setBounce(0, 0);
      p.setData('expireAt', null);
    }
  }

  protected deactivateBossProjectile(p: Phaser.Physics.Arcade.Sprite): void {
    p.setActive(false).setVisible(false);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    // CRÍTICO: o overlap do Arcade percorre os corpos *habilitados* do grupo —
    // `active=false` não basta. Sem desabilitar o corpo, o projétil fica
    // invisível e parado mas ainda colide, re-aplicando dano se o player passa
    // pelo local onde foi atingido. Desabilitar tira o corpo do mundo de física.
    body.enable = false;
  }

  private cullBossProjectiles(time: number): void {
    const { width, height } = this.scale;
    this.bossProjectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) return;
      const expireAt = p.getData('expireAt') as number | null;
      if (expireAt !== null && expireAt !== undefined && time > expireAt) {
        this.deactivateBossProjectile(p);
        return;
      }
      if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        this.deactivateBossProjectile(p);
        return;
      }
      // Rastro luminoso — o loop já visita todo projétil ativo por frame
      const tint = p.getData('trailTint') as number | undefined;
      if (tint) this.getTrailEmitter(tint).emitParticleAt(p.x, p.y);
    });
  }

  /** Emitter de rastro por cor — criado sob demanda, compartilhado pelo pool. */
  protected getTrailEmitter(tint: number): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.trailEmitters.get(tint);
    if (!e) {
      e = this.add
        .particles(0, 0, makeParticleDot(this), {
          lifespan: 220,
          scale: { start: 0.55, end: 0 },
          alpha: { start: 0.5, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
          tint,
          frequency: -1,
        })
        .setDepth(3);
      this.trailEmitters.set(tint, e);
    }
    return e;
  }

  // ── Overlaps ──────────────────────────────────────────────────

  private setupOverlaps(): void {
    // Projéteis do boss → Plankton
    this.physics.add.overlap(
      this.plankton,
      this.bossProjectilePool,
      (_player, _proj) => {
        const proj = _proj as Phaser.Physics.Arcade.Sprite;
        const damage = proj.getData('damage') as number ?? 1;
        const effect = proj.getData('effect') as 'freeze' | null;
        const burstPalette = effect === 'freeze' ? ATTACK_PALETTES.ice : this.getBossPalette();
        impactBurst(this, proj.x, proj.y, burstPalette);
        this.deactivateBossProjectile(proj);
        if (this.plankton.receiveDamage(damage)) {
          // Efeito só pega se o golpe conectou (dash/invencibilidade esquivam)
          if (effect === 'freeze') {
            this.plankton.applyFreezeEffect(CONSTANTS.ICE_FREEZE_DURATION_MS);
          }
          this.updateHUD();
        }
      },
      undefined,
      this,
    );
  }

  // Laser do Plankton → boss (geométrico — Container não tem physics body)
  /**
   * Alvos atingíveis pelo laser do Plankton. Default: o boss único. Cenas com
   * múltiplos bosses (ex.: FinalScene) sobrescrevem para alvos independentes.
   */
  protected getBossHitTargets(): { rect: Phaser.Geom.Rectangle; hit: (dmg: number) => void }[] {
    if (this.boss.isBossDefeated()) return [];
    return [{ rect: this.boss.getHitBounds(), hit: (d) => this.boss.receiveDamage(d) }];
  }

  private checkLaserBossOverlap(): void {
    const targets = this.getBossHitTargets();
    if (targets.length === 0) return;
    this.plankton.getProjectileGroup().getChildren().forEach((obj) => {
      const laser = obj as Phaser.Physics.Arcade.Sprite;
      if (!laser.active) return;
      const lb = laser.getBounds();
      for (const t of targets) {
        if (Phaser.Geom.Intersects.RectangleToRectangle(lb, t.rect)) {
          impactBurst(this, laser.x, laser.y, ATTACK_PALETTES.plankton);
          laser.setActive(false).setVisible(false);
          (laser.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
          t.hit(CONSTANTS.PLANKTON_LASER_DAMAGE);
          this.skillCharge.addFromDamage(CONSTANTS.PLANKTON_LASER_DAMAGE);
          break;
        }
      }
    });
  }

  // ── HUD ───────────────────────────────────────────────────────

  private static readonly BOSS_BAR_W = 420;
  private static readonly BOSS_BAR_H = 16;
  private static readonly SKILL_BAR_W = 220;
  private static readonly SKILL_BAR_H = 14;

  protected buildBossHpBar(width: number): void {
    const barW = BossPhaseScene.BOSS_BAR_W;
    const barH = BossPhaseScene.BOSS_BAR_H;
    const cx = width / 2;
    const y = 40;
    const left = cx - barW / 2;

    this.add
      .text(cx, y - 14, this.getBossName(), display(13, COLORS_CSS.text))
      .setOrigin(0.5, 1)
      .setDepth(5);

    const track = this.add.graphics().setDepth(5);
    track.fillStyle(COLORS.panelDark, 0.85);
    track.fillRoundedRect(left, y - barH / 2, barW, barH, barH / 2);
    track.lineStyle(1, COLORS.cyan, 0.3);
    track.strokeRoundedRect(left, y - barH / 2, barW, barH, barH / 2);

    // Chip branco por baixo do fill: marca o dano e "escorre" com atraso
    this.bossHpChip = this.add
      .rectangle(left + 2, y, barW - 4, barH - 6, 0xffffff, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(6);
    this.bossHpFill = this.add
      .rectangle(left + 2, y, barW - 4, barH - 6, this.getBossBarColor())
      .setOrigin(0, 0.5)
      .setDepth(7);
  }

  private buildHUD(width: number): void {
    // Pips de vida do Plankton — glow assado, leitura clara contra cenários
    makeGlowTexture(this, 'hud-hp-pip', { core: 0xffffff, mid: COLORS.success, halo: 0x1b5e20 }, 11);
    const startX = width - 20;
    for (let i = 0; i < CONSTANTS.PLANKTON_MAX_HP; i++) {
      const pip = this.add
        .image(startX - 14 - i * 30, 60, 'hud-hp-pip')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(10);
      this.planktonHearts.push(pip);
    }
    this.add
      .text(width - 20, 80, 'PLANKTON', caption(11, COLORS_CSS.success))
      .setOrigin(1, 0)
      .setDepth(10);

    // Barra da Habilidade Suprema (canto inferior esquerdo)
    const barX = 20;
    const barY = this.scale.height - 46;
    const barW = BossPhaseScene.SKILL_BAR_W;
    const barH = BossPhaseScene.SKILL_BAR_H;

    const track = this.add.graphics().setDepth(10);
    track.fillStyle(COLORS.panelDark, 0.85);
    track.fillRoundedRect(barX, barY - barH / 2, barW, barH, barH / 2);
    track.lineStyle(1, COLORS.skill, 0.25);
    track.strokeRoundedRect(barX, barY - barH / 2, barW, barH, barH / 2);

    this.skillBarFill = this.add
      .rectangle(barX + 2, barY, 0, barH - 4, COLORS.skill)
      .setOrigin(0, 0.5)
      .setDepth(11);
    this.skillLabel = this.add
      .text(barX, barY - 24, 'SUPREMA — [Q]', caption(11, COLORS_CSS.skill))
      .setDepth(10);
  }

  private buildControlsHint(width: number, height: number): void {
    this.add
      .text(width / 2, height - 8, this.getControlsHint(), mono(11, COLORS_CSS.textDim))
      .setOrigin(0.5, 1)
      .setAlpha(0.7)
      .setDepth(10);
  }

  protected updateHUD(): void {
    const hp = this.plankton.getHp();
    if (hp === this.planktonHpLast) return;
    const lost = this.planktonHpLast - hp;
    for (let i = 0; i < lost; i++) {
      const pip = this.planktonHearts[this.planktonHpLast - 1 - i];
      if (pip?.visible) {
        impactBurst(this, pip.x, pip.y, { core: 0xffffff, mid: COLORS.danger, halo: 0x7f0000 }, {
          particles: 5,
          scale: 0.7,
          depth: 12,
        });
        this.tweens.add({
          targets: pip, scaleX: 0, scaleY: 0, duration: 300,
          onComplete: () => pip.setVisible(false),
        });
      }
    }
    this.planktonHpLast = hp;

    // Último pip pulsa em alerta
    if (hp === 1 && !this.lowHpPulse) {
      const last = this.planktonHearts[0];
      last.setTint(COLORS.danger);
      this.lowHpPulse = this.tweens.add({
        targets: last,
        scale: 1.25,
        duration: 320,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private updateSkillBar(): void {
    const barW = BossPhaseScene.SKILL_BAR_W - 4;
    this.skillBarFill.width = barW * this.skillCharge.getPercent();

    const ready = this.skillCharge.isReady();
    if (ready && !this.skillWasReady) {
      // Rising edge: burst único + label de prontidão
      impactBurst(this, 20 + barW, this.scale.height - 46, ATTACK_PALETTES.suprema, {
        particles: 12,
        depth: 12,
      });
      this.skillLabel.setText('SUPREMA PRONTA — [Q]').setColor(COLORS_CSS.gold);
    } else if (!ready && this.skillWasReady) {
      this.skillLabel.setText('SUPREMA — [Q]').setColor(COLORS_CSS.skill);
    }
    this.skillWasReady = ready;

    if (ready && !this.skillReadyPulse) {
      this.skillReadyPulse = this.tweens.add({
        targets: this.skillBarFill,
        alpha: 0.55,
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!ready && this.skillReadyPulse) {
      this.skillReadyPulse.stop();
      this.skillReadyPulse = null;
      this.skillBarFill.setAlpha(1);
    }
  }

  // ── EventBus listeners ────────────────────────────────────────

  private onBossDamaged(data: { currentHp: number; maxHp: number; bossId: BossId }): void {
    if (data.bossId !== this.boss.getBossId()) return;
    const barW = BossPhaseScene.BOSS_BAR_W - 4;
    const pct = data.currentHp / data.maxHp;
    // Fill responde rápido; o chip branco "escorre" atrás mostrando o dano
    tweenBarTo(this, this.bossHpFill, barW, pct, 200);
    tweenBarTo(this, this.bossHpChip, barW, pct, 600, 250);
  }

  private onBossDefeated(data: { bossId: BossId }): void {
    if (data.bossId !== this.boss.getBossId()) return;

    GameState.getInstance().completePhase(this.boss.getBossId(), '');

    const cx = CONSTANTS.GAME_WIDTH / 2;
    const cy = CONSTANTS.GAME_HEIGHT / 2;

    // Explosão de vitória em gold/orange sobre o boss
    impactBurst(this, this.boss.x, this.boss.y, { core: 0xffffff, mid: COLORS.gold, halo: COLORS.orange }, {
      particles: 30,
      scale: 2.2,
      depth: 19,
    });

    const victory = this.add
      .text(cx, cy, this.getVictoryText(), display(40))
      .setOrigin(0.5)
      .setDepth(20)
      .setScale(0);
    this.tweens.add({
      targets: victory,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    const sub = this.add
      .text(cx, cy + 42, '— FRAGMENTO RECUPERADO —', caption(13))
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 300 });

    this.time.delayedCall(2000, () => {
      fadeToScene(this, this.getNextSceneKey(), undefined, 450);
    });
  }

  private onBossFinalPhase(data: { bossId: BossId }): void {
    if (data.bossId !== this.boss.getBossId()) return;
    // Aura de fúria — único uso da Filters API (1 objeto, custo aceitável)
    this.boss.enableFilters();
    this.boss.filters?.internal.addGlow(this.getBossPalette().mid, 4);
    this.onBossFinalPhaseHook();
  }

  private onPlayerDefeated(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    const { width, height } = this.scale;
    this.physics.pause();
    this.cameras.main.shake(150, 0.006);

    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(30);
    this.tweens.add({ targets: overlay, fillAlpha: 0.75, duration: 300 });

    const title = this.add
      .text(width / 2, height / 2 - 40, 'PLANKTON FOI DERROTADO', display(36, COLORS_CSS.danger))
      .setOrigin(0.5)
      .setDepth(31)
      .setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 300 });

    const retry = this.add
      .text(width / 2, height / 2 + 30, '[R] tentar novamente', mono(16, COLORS_CSS.gold))
      .setOrigin(0.5)
      .setDepth(31);
    this.tweens.add({
      targets: retry,
      alpha: 0.45,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        window.removeEventListener('keydown', onKeyDown);
        this.scene.restart({ bossDialogDone: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKeyDown);
    });
  }

  // ── Habilidade Suprema — Âncoras Amaldiçoadas ─────────────────

  private castAnchors(): void {
    EventBus.emit('skill:activated', { subAttack: 'primary' });

    const { width, height } = this.scale;
    const groundY = height - 50;

    // O céu da arena escurece em verde fantasma — presença do Holandês
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0x1b5e20, 0.3).setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    this.cameras.main.shake(200, 0.005);

    // Padrão diagonal cobrindo bem mais da tela
    const start = width / 5 + 30;
    const span = width - start - 70;
    for (let i = 0; i < CONSTANTS.ANCHOR_COUNT; i++) {
      const x = start + (span / (CONSTANTS.ANCHOR_COUNT - 1)) * i;
      this.time.delayedCall(i * CONSTANTS.ANCHOR_STAGGER_MS, () => this.dropAnchor(x, groundY));
    }
  }

  private dropAnchor(x: number, groundY: number): void {
    // Aviso no chão antes da queda — anel espectral + pulso interno
    const ring = this.add.graphics().setDepth(3);
    ring.lineStyle(2, ATTACK_PALETTES.suprema.mid, 0.9);
    ring.strokeEllipse(x, groundY, 110, 18);
    const pulse = this.add
      .ellipse(x, groundY, 96, 14, ATTACK_PALETTES.suprema.mid, 0.3)
      .setDepth(3);
    this.tweens.add({
      targets: pulse,
      alpha: 0.08,
      scaleX: 0.7,
      scaleY: 0.7,
      duration: 180,
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(CONSTANTS.ANCHOR_WARNING_MS, () => {
      ring.destroy();
      pulse.destroy();

      const anchor = this.add.image(x, -40, 'anchor').setDepth(8);
      // ≤4 âncoras vivas e curtas: o único outro uso da Filters API
      anchor.enableFilters();
      anchor.filters?.internal.addGlow(ATTACK_PALETTES.suprema.mid, 3);
      this.tweens.add({
        targets: anchor,
        y: groundY - 32,
        duration: 280,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.cameras.main.shake(120, 0.006);
          this.applyAnchorDamage(x);

          // Poeira do impacto + brasas espectrais subindo
          const dust = this.add.ellipse(x, groundY, 130, 24, 0x8d6e63, 0.5).setDepth(7);
          this.tweens.add({ targets: dust, alpha: 0, scaleX: 1.6, duration: 400, onComplete: () => dust.destroy() });

          const embers = this.add
            .particles(x, groundY - 10, makeParticleDot(this), {
              speedY: { min: -120, max: -40 },
              speedX: { min: -50, max: 50 },
              lifespan: { min: 350, max: 650 },
              scale: { start: 0.8, end: 0 },
              alpha: { start: 0.9, end: 0 },
              blendMode: Phaser.BlendModes.ADD,
              tint: ATTACK_PALETTES.suprema.mid,
              emitting: false,
            })
            .setDepth(9);
          embers.explode(10, 0, 0);
          this.time.delayedCall(700, () => embers.destroy());

          this.tweens.add({
            targets: anchor,
            alpha: 0,
            duration: 500,
            delay: 350,
            onComplete: () => anchor.destroy(),
          });
        },
      });
    });
  }

  // GDD: dano massivo no impacto direto; dano indireto reduzido significativamente
  private applyAnchorDamage(anchorX: number): void {
    if (this.boss.isBossDefeated()) return;
    const dist = Math.abs(this.boss.x - anchorX);
    if (dist <= CONSTANTS.ANCHOR_DIRECT_RADIUS) {
      this.boss.receiveDamage(CONSTANTS.ANCHOR_DAMAGE_DIRECT);
    } else if (dist <= CONSTANTS.ANCHOR_SPLASH_RADIUS) {
      this.boss.receiveDamage(CONSTANTS.ANCHOR_DAMAGE_SPLASH);
    }
  }

  // ── Habilidade Suprema — Onda de Surf (Bob Esponja) ───────────

  private drawBezierCurve(
    g: Phaser.GameObjects.Graphics,
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    segments = 16
  ): void {
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const c0 = mt * mt * mt;
      const c1 = 3 * mt * mt * t;
      const c2 = 3 * mt * t * t;
      const c3 = t * t * t;
      
      const x = c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3;
      const y = c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3;
      g.lineTo(x, y);
    }
  }

  private castSurfWave(): void {
    EventBus.emit('skill:activated', { subAttack: 'secondary' });

    const { width, height } = this.scale;
    const groundY = height - 50;

    this.destroySurfWave();
    this.surfWaveHitBoss = false;

    // Dark cyan flash on activation
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0x00bcd4, 0.25).setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
    this.cameras.main.shake(300, 0.005);

    // Create wave container (positioned offscreen initially) — onda maior
    const container = this.add.container(-250, groundY).setDepth(10).setScale(1.35);

    // 1. Trailing Wave Graphics
    const waveGraphics = this.add.graphics();
    
    // Dark ocean blue body (matches bottom of image: 0x0375a9)
    waveGraphics.fillStyle(0x0375a9, 0.95);
    waveGraphics.beginPath();
    waveGraphics.moveTo(-320, 0);
    // Left curve to crest at (0, -175)
    this.drawBezierCurve(waveGraphics, -320, 0, -220, -45, -100, -130, 0, -175);
    // Right curve from crest to ground at (120, 0)
    this.drawBezierCurve(waveGraphics, 0, -175, 50, -175, 95, -85, 120, 0);
    waveGraphics.lineTo(120, 0);
    waveGraphics.lineTo(-320, 0);
    waveGraphics.closePath();
    waveGraphics.fill();

    // Medium blue active water layer (matches middle of image: 0x0c90e2)
    waveGraphics.fillStyle(0x0c90e2, 0.95);
    waveGraphics.beginPath();
    waveGraphics.moveTo(-290, 0);
    this.drawBezierCurve(waveGraphics, -290, 0, -200, -35, -90, -115, 0, -155);
    this.drawBezierCurve(waveGraphics, 0, -155, 45, -155, 85, -75, 105, 0);
    waveGraphics.lineTo(105, 0);
    waveGraphics.lineTo(-290, 0);
    waveGraphics.closePath();
    waveGraphics.fill();

    // Cyan active water layer (matches top background of image: 0x42e0c7)
    waveGraphics.fillStyle(0x42e0c7, 0.98);
    waveGraphics.beginPath();
    waveGraphics.moveTo(-270, 0);
    this.drawBezierCurve(waveGraphics, -270, 0, -180, -30, -80, -100, 0, -135);
    this.drawBezierCurve(waveGraphics, 0, -135, 40, -135, 75, -65, 90, 0);
    waveGraphics.lineTo(90, 0);
    waveGraphics.lineTo(-270, 0);
    waveGraphics.closePath();
    waveGraphics.fill();

    // Cartoon flowing outline curves for stylized water movement
    waveGraphics.lineStyle(2, 0xffffff, 0.6);
    // Outline for dark blue crest
    waveGraphics.beginPath();
    waveGraphics.moveTo(-320, 0);
    this.drawBezierCurve(waveGraphics, -320, 0, -220, -45, -100, -130, 0, -175);
    this.drawBezierCurve(waveGraphics, 0, -175, 50, -175, 95, -85, 120, 0);
    waveGraphics.strokePath();

    // Outline for medium blue layer
    waveGraphics.lineStyle(1.5, 0xffffff, 0.45);
    waveGraphics.beginPath();
    waveGraphics.moveTo(-290, 0);
    this.drawBezierCurve(waveGraphics, -290, 0, -200, -35, -90, -115, 0, -155);
    this.drawBezierCurve(waveGraphics, 0, -155, 45, -155, 85, -75, 105, 0);
    waveGraphics.strokePath();

    // Thin flow lines inside the wave body to give movement detail
    waveGraphics.lineStyle(1.5, 0xffffff, 0.25);
    waveGraphics.beginPath();
    waveGraphics.moveTo(-250, 0);
    this.drawBezierCurve(waveGraphics, -250, 0, -180, -30, -100, -90, -20, -130);
    waveGraphics.strokePath();

    waveGraphics.beginPath();
    waveGraphics.moveTo(-200, 0);
    this.drawBezierCurve(waveGraphics, -200, 0, -140, -25, -80, -70, -10, -100);
    waveGraphics.strokePath();

    container.add(waveGraphics);

    // 2. The Surfing SpongeBob Image (head of the wave)
    // Positioned a bit lower at y=-170 (submerged slightly in the wave crest)
    const bobSurf = this.add.sprite(0, -170, 'bob-surf').setOrigin(0.5, 0.95);
    bobSurf.setDisplaySize(186, 150); // Scaled down (approx 25% smaller, aspect ratio preserved)
    
    // Float/bobbing effect inside the wave
    this.tweens.add({
      targets: bobSurf,
      y: -176,
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    container.add(bobSurf);

    // 3. Spray, wake, shadow and droplet foam graphics around the board
    const blendGraphics = this.add.graphics();
    
    // Board shadow on the wave surface (gives depth and grounds the sprite)
    blendGraphics.fillStyle(0x011b2b, 0.6);
    blendGraphics.fillEllipse(0, -168, 70, 12);

    // Draw white foam circles around the surfboard bottom to simulate spray/wake
    blendGraphics.fillStyle(0xffffff, 0.95);
    
    // Board wake (spraying backwards on the left)
    blendGraphics.fillCircle(-60, -165, 12);
    blendGraphics.fillCircle(-45, -167, 14);
    blendGraphics.fillCircle(-30, -170, 16);
    blendGraphics.fillCircle(-75, -160, 9);
    blendGraphics.fillCircle(-90, -155, 7);

    // Splashes in front of the board (on the right)
    blendGraphics.fillCircle(40, -168, 10);
    blendGraphics.fillCircle(55, -165, 8);
    blendGraphics.fillCircle(70, -160, 6);

    // Board bottom spray (cyan highlights)
    blendGraphics.fillStyle(0x51decb, 0.85);
    blendGraphics.fillCircle(-40, -160, 8);
    blendGraphics.fillCircle(0, -158, 10);
    blendGraphics.fillCircle(30, -160, 8);

    // Droplet spray (small floating circles representing water droplets flying off the crest)
    blendGraphics.fillStyle(0xffffff, 0.8);
    blendGraphics.fillCircle(-15, -185, 3.5);
    blendGraphics.fillCircle(-30, -195, 4.5);
    blendGraphics.fillCircle(-8, -205, 3.0);
    blendGraphics.fillCircle(8, -190, 3.5);
    blendGraphics.fillCircle(22, -200, 4.0);
    blendGraphics.fillCircle(38, -185, 3.0);
    
    // Darker cyan highlights
    blendGraphics.fillStyle(0x0c90e2, 0.7);
    blendGraphics.fillCircle(-60, -180, 10);
    blendGraphics.fillCircle(60, -180, 10);
    
    container.add(blendGraphics);

    // Enable physics on the container
    this.physics.add.existing(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(600);

    this.surfWave = container;
  }

  private destroySurfWave(): void {
    if (this.surfWave) {
      this.surfWave.destroy();
      this.surfWave = null;
    }
  }
}
