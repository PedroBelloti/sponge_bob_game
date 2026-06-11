import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { EventBus } from '../../core/EventBus';
import type { BossId } from '../../core/EventBus';
import { Plankton } from '../../entities/Plankton';
import type { WASDKeys } from '../../entities/PlayerBase';
import type { BaseBoss, ProjectileData } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { GameState } from '../../state/GameState';
import { SkillCharge } from '../../systems/SkillCharge';

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

  private wasd!: WASDKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dashKey!: Phaser.Input.Keyboard.Key;
  private skillKey!: Phaser.Input.Keyboard.Key;

  private bossProjectilePool!: Phaser.Physics.Arcade.Group;
  private bossHpFill!: Phaser.GameObjects.Rectangle;

  private planktonHearts: Phaser.GameObjects.Arc[] = [];
  private planktonHpLast: number = CONSTANTS.PLANKTON_MAX_HP;
  private skillBarFill!: Phaser.GameObjects.Rectangle;
  private skillReadyPulse: Phaser.Tweens.Tween | null = null;

  // ── Contrato da subclasse ─────────────────────────────────────

  /** Visual da arena + this.ground e this.platforms preenchidos. */
  protected abstract buildArena(width: number, height: number): void;
  protected abstract createBoss(width: number, height: number): BaseBoss;
  protected abstract getDialog(): DialogConfig;
  protected abstract getNextSceneKey(): string;
  protected abstract getBossProjectileTextureKey(): string;
  protected abstract getBossBarColor(): number;

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

    // Estado precisa resetar a cada (re)início da cena
    this.isGameOver = false;
    this.planktonHearts = [];
    this.planktonHpLast = CONSTANTS.PLANKTON_MAX_HP;
    this.skillCharge = new SkillCharge();
    this.skillReadyPulse = null;

    this.buildCommonTextures();
    this.buildArena(width, height);
    this.boss = this.createBoss(width, height);
    this.boss.setDepth(2);
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

    // Habilidade Suprema
    if (Phaser.Input.Keyboard.JustDown(this.skillKey) && this.skillCharge.consume()) {
      this.castAnchors();
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
    this.plankton = new Plankton(this, 150, height - 50 - 44);
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
    p.setData('damage', data.damage);
    p.setData('effect', data.effect ?? null);
    const body = p.body as Phaser.Physics.Arcade.Body;
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
    (p.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
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
      }
    });
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
  private checkLaserBossOverlap(): void {
    if (this.boss.isBossDefeated()) return;
    const bossRect = this.boss.getHitBounds();
    this.plankton.getProjectileGroup().getChildren().forEach((obj) => {
      const laser = obj as Phaser.Physics.Arcade.Sprite;
      if (!laser.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(laser.getBounds(), bossRect)) {
        laser.setActive(false).setVisible(false);
        (laser.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.boss.receiveDamage(CONSTANTS.PLANKTON_LASER_DAMAGE);
        this.skillCharge.addFromDamage(CONSTANTS.PLANKTON_LASER_DAMAGE);
      }
    });
  }

  // ── HUD ───────────────────────────────────────────────────────

  private buildBossHpBar(width: number): void {
    const barW = 300;
    const cx = width / 2;
    const y = 40;
    this.add.rectangle(cx, y, barW, 20, 0x333333).setDepth(5);
    this.bossHpFill = this.add.rectangle(cx, y, barW, 20, this.getBossBarColor()).setDepth(6);
  }

  private buildHUD(width: number): void {
    const startX = width - 20;
    for (let i = 0; i < CONSTANTS.PLANKTON_MAX_HP; i++) {
      const heart = this.add.arc(startX - 14 - i * 30, 60, 12, 0, 360, false, 0x4caf50).setDepth(10);
      this.planktonHearts.push(heart);
    }
    this.add.text(width - 20, 80, 'PLANKTON', { fontSize: '12px', color: '#4CAF50' }).setOrigin(1, 0).setDepth(10);

    // Barra da Habilidade Suprema (canto inferior esquerdo)
    const barX = 20;
    const barY = this.scale.height - 46;
    const barW = 220;
    const barH = 14;
    this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x222222).setDepth(10);
    this.skillBarFill = this.add
      .rectangle(barX, barY, 0, barH, 0x39ff14)
      .setOrigin(0, 0.5)
      .setDepth(11);
    this.add
      .text(barX, barY - 22, 'SUPREMA — Q', { fontSize: '12px', color: '#39FF14' })
      .setDepth(10);
  }

  private buildControlsHint(width: number, height: number): void {
    this.add
      .text(width / 2, height - 8, this.getControlsHint(), {
        fontSize: '12px', color: '#8D6E63',
      })
      .setOrigin(0.5, 1)
      .setDepth(10);
  }

  private updateHUD(): void {
    const hp = this.plankton.getHp();
    if (hp === this.planktonHpLast) return;
    const lost = this.planktonHpLast - hp;
    for (let i = 0; i < lost; i++) {
      const heart = this.planktonHearts[this.planktonHpLast - 1 - i];
      if (heart?.visible) {
        this.tweens.add({
          targets: heart, scaleX: 0, scaleY: 0, duration: 300,
          onComplete: () => heart.setVisible(false),
        });
      }
    }
    this.planktonHpLast = hp;
  }

  private updateSkillBar(): void {
    const barW = 220;
    this.skillBarFill.width = barW * this.skillCharge.getPercent();

    if (this.skillCharge.isReady() && !this.skillReadyPulse) {
      this.skillReadyPulse = this.tweens.add({
        targets: this.skillBarFill,
        alpha: 0.5,
        duration: 350,
        yoyo: true,
        repeat: -1,
      });
    } else if (!this.skillCharge.isReady() && this.skillReadyPulse) {
      this.skillReadyPulse.stop();
      this.skillReadyPulse = null;
      this.skillBarFill.setAlpha(1);
    }
  }

  // ── EventBus listeners ────────────────────────────────────────

  private onBossDamaged(data: { currentHp: number; maxHp: number; bossId: BossId }): void {
    if (data.bossId !== this.boss.getBossId()) return;
    this.bossHpFill.setDisplaySize(300 * (data.currentHp / data.maxHp), 20);
  }

  private onBossDefeated(data: { bossId: BossId }): void {
    if (data.bossId !== this.boss.getBossId()) return;

    GameState.getInstance().completePhase(this.boss.getBossId(), '');

    this.add
      .text(CONSTANTS.GAME_WIDTH / 2, CONSTANTS.GAME_HEIGHT / 2, this.getVictoryText(), {
        fontSize: '28px', color: '#FFD700', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.time.delayedCall(2000, () => {
      this.scene.start(this.getNextSceneKey());
    });
  }

  private onBossFinalPhase(data: { bossId: BossId }): void {
    if (data.bossId !== this.boss.getBossId()) return;
    this.onBossFinalPhaseHook();
  }

  private onPlayerDefeated(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    const { width, height } = this.scale;
    this.physics.pause();

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(30);
    this.add
      .text(width / 2, height / 2 - 40, 'PLANKTON FOI DERROTADO', {
        fontSize: '34px', color: '#FF1744', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(31);

    const retry = this.add
      .text(width / 2, height / 2 + 30, 'R  Tentar novamente', {
        fontSize: '18px', color: '#FFD700',
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.tweens.add({ targets: retry, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    // Diálogo não se repete no retry — a escolha já está registrada
    this.input.keyboard!.once('keydown-R', () => {
      this.scene.restart({ bossDialogDone: true });
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

    // Padrão diagonal cobrindo ~2/3 da tela, sempre sobre o lado do boss
    const start = width / 3 + 60;
    const span = width - start - 80;
    for (let i = 0; i < CONSTANTS.ANCHOR_COUNT; i++) {
      const x = start + (span / (CONSTANTS.ANCHOR_COUNT - 1)) * i;
      this.time.delayedCall(i * CONSTANTS.ANCHOR_STAGGER_MS, () => this.dropAnchor(x, groundY));
    }
  }

  private dropAnchor(x: number, groundY: number): void {
    // Aviso no chão antes da queda — leitura clara pro jogador
    const warning = this.add
      .ellipse(x, groundY, 110, 18, 0x39ff14, 0.35)
      .setDepth(3);
    this.tweens.add({ targets: warning, alpha: 0.1, duration: 150, yoyo: true, repeat: -1 });

    this.time.delayedCall(CONSTANTS.ANCHOR_WARNING_MS, () => {
      warning.destroy();

      const anchor = this.add.image(x, -40, 'anchor').setDepth(8);
      this.tweens.add({
        targets: anchor,
        y: groundY - 32,
        duration: 280,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.cameras.main.shake(120, 0.006);
          this.applyAnchorDamage(x);

          // Poeira do impacto
          const dust = this.add.ellipse(x, groundY, 130, 24, 0x8d6e63, 0.5).setDepth(7);
          this.tweens.add({ targets: dust, alpha: 0, scaleX: 1.6, duration: 400, onComplete: () => dust.destroy() });

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
}
