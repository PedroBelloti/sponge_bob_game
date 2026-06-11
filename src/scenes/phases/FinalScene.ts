import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { FinalBoss } from '../../entities/bosses/FinalBoss';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { BossPhaseScene } from './BossPhaseScene';
import {
  ATTACK_PALETTES,
  COLORS_CSS,
  caption,
  display,
  makeGlowCapsule,
  makeGlowTexture,
  mono,
} from '../../config/theme';
import type { AttackPalette } from '../../config/theme';

export class FinalScene extends BossPhaseScene {
  private finalBoss!: FinalBoss;

  // Correntes Marinhas (Scenario Help)
  private currentDirection: 'left' | 'right' | 'none' = 'none';
  private currentTimer: Phaser.Time.TimerEvent | null = null;
  private currentParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private currentLabel: Phaser.GameObjects.Text | null = null;

  // Whirlpool (M2) state
  private lastWhirlpoolTime: number = 0;
  private isWhirlpoolActive: boolean = false;
  private whirlpoolCenter = { x: 640, y: 340 };
  private warningCircle: Phaser.GameObjects.Graphics | null = null;
  private whirlpoolParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor() {
    super({ key: 'FinalScene' });
  }

  // ── BossPhaseScene impl ───────────────────────────────────────

  protected buildArena(width: number, height: number): void {
    this.buildTextures();

    // Backdrop oceânico profundo
    this.cameras.main.setBackgroundColor('#040c1a');

    this.add
      .text(16, 16, '◆ ARENA OCEÂNICA', caption(12, COLORS_CSS.text))
      .setShadow(1, 1, '#000000', 2);

    // Chão de rochas profundas
    this.ground = this.physics.add.staticGroup();
    const ground = this.ground.create(width / 2, height - 25, 'final-ground') as Phaser.Physics.Arcade.Sprite;
    ground.refreshBody();

    // Plataformas bioluminescentes
    this.platforms = this.physics.add.staticGroup();
    this.addOneWayPlatform(300, 540, 'final-platform');
    this.addOneWayPlatform(980, 540, 'final-platform');
    this.addOneWayPlatform(640, 420, 'final-platform');

    // Inicializar partículas de bolhas para as correntes
    this.currentParticles = this.add.particles(0, 0, 'fx-dot', {
      x: { min: -50, max: width + 50 },
      y: { min: 0, max: height },
      lifespan: 3000,
      scale: { start: 0.3, end: 0.9 },
      alpha: { start: 0.4, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: 0x80deea,
      emitting: false,
    }).setDepth(1);
  }

  protected createBoss(_width: number, height: number): BaseBoss {
    this.finalBoss = new FinalBoss(this, 1050, height - 120);
    return this.finalBoss;
  }

  // Sem diálogo interativo antes da luta final (GDD)
  protected getDialog(): DialogConfig {
    return {
      bossId: 'final',
      speakerName: 'HOMEM SEREIA',
      lines: [
        'PLANKTON! Sua vilania termina aqui no fundo do oceano!',
        'Prepare-se para enfrentar o poder da justiça!',
      ],
      choiceA: 'Eu vou lutar com todas as minhas forças!',
      choiceB: 'Tanto faz. Eu vou recuperar esse fragmento!',
      nextScene: 'FinalScene',
      nextSceneData: { bossDialogDone: true },
    };
  }

  protected getNextSceneKey(): string {
    return 'EndingScene';
  }

  protected getBossProjectileTextureKey(): string {
    return 'mermaid-ray';
  }

  protected getBossBarColor(): number {
    return ATTACK_PALETTES.mermaidMan.mid;
  }

  protected getBossPalette(): AttackPalette {
    return ATTACK_PALETTES.mermaidMan;
  }

  protected getBossName(): string {
    return 'HOMEM SEREIA & MEXILHÃOZINHO';
  }

  protected onArenaCreate(): void {
    this.lastWhirlpoolTime = this.time.now;
    this.isWhirlpoolActive = false;

    // Ciclo de mudança das correntes marinhas a cada 15 segundos (GDD)
    this.currentDirection = 'none';
    this.currentTimer = this.time.addEvent({
      delay: CONSTANTS.CURRENT_CHANGE_INTERVAL,
      loop: true,
      callback: this.cycleMarineCurrents,
      callbackScope: this,
    });

    // Partículas do redemoinho
    this.whirlpoolParticles = this.add.particles(this.whirlpoolCenter.x, this.whirlpoolCenter.y, 'fx-dot', {
      speed: { min: 100, max: 200 },
      lifespan: 1500,
      scale: { start: 0.2, end: 1.2 },
      alpha: { start: 0.6, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: 0x80deea,
      emitting: false,
    }).setDepth(3);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.currentTimer?.remove();
      this.whirlpoolParticles?.destroy();
      this.currentParticles?.destroy();
    });
  }

  protected onArenaUpdate(time: number): void {
    // 1. Aplicar força das correntes marinhas sobre Plankton
    const body = this.plankton.body as Phaser.Physics.Arcade.Body;
    if (this.currentDirection === 'left') {
      body.setVelocityX(body.velocity.x - 70);
    } else if (this.currentDirection === 'right') {
      body.setVelocityX(body.velocity.x + 70);
    }

    // 2. Trajetória guiada das bolhas de Mexilhãozinho
    this.bossProjectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (p.active && p.visible && p.texture.key === 'barnacle-bubble') {
        const pBody = p.body as Phaser.Physics.Arcade.Body;
        const angle = Phaser.Math.Angle.Between(p.x, p.y, this.plankton.x, this.plankton.y);
        const speed = 250 * (this.finalBoss.getIsPrime() ? CONSTANTS.PRIME_SPEED_MULTIPLIER : 1.0);
        const targetVx = Math.cos(angle) * speed;
        const targetVy = Math.sin(angle) * speed;
        
        // Suave ajuste de rumo (4% por frame)
        pBody.setVelocity(
          Phaser.Math.Linear(pBody.velocity.x, targetVx, 0.04),
          Phaser.Math.Linear(pBody.velocity.y, targetVy, 0.04)
        );
      }
    });

    // 3. Mecânica de sucção do Redemoinho duplo (M2)
    if (this.isWhirlpoolActive) {
      const angle = Phaser.Math.Angle.Between(this.plankton.x, this.plankton.y, this.whirlpoolCenter.x, this.whirlpoolCenter.y);
      const pullForce = this.finalBoss.getIsPrime() ? 150 : 100;
      body.setVelocity(
        body.velocity.x + Math.cos(angle) * pullForce * 0.1,
        body.velocity.y + Math.sin(angle) * pullForce * 0.1
      );
    }

    // 4. Agendar Redemoinho Duplo (M2)
    if (!this.isWhirlpoolActive && time - this.lastWhirlpoolTime >= this.finalBoss.getConfig().m2Cooldown) {
      this.lastWhirlpoolTime = time;
      this.triggerWhirlpoolAttack();
    }
  }

  // ── Correntes Marinhas ────────────────────────────────────────

  private cycleMarineCurrents(): void {
    if (this.isGameOver || this.finalBoss.isBossDefeated()) return;

    const dirs: ('left' | 'right' | 'none')[] = ['left', 'none', 'right', 'none'];
    const idx = (dirs.indexOf(this.currentDirection) + 1) % dirs.length;
    this.currentDirection = dirs[idx];

    // Mostrar aviso na tela
    this.currentLabel?.destroy();
    let text = 'Correntes Calmas';
    let color: string = COLORS_CSS.textDim;
    if (this.currentDirection === 'left') {
      text = '◀ Corrente Marinha Forte (Esquerda)';
      color = COLORS_CSS.cyan;
      this.currentParticles?.start(0);
      if (this.currentParticles) {
        (this.currentParticles as any).speedX = { min: -400, max: -200 };
        (this.currentParticles as any).speedY = { min: -20, max: 20 };
      }
    } else if (this.currentDirection === 'right') {
      text = 'Corrente Marinha Forte (Direita) ▶';
      color = COLORS_CSS.cyan;
      this.currentParticles?.start(0);
      if (this.currentParticles) {
        (this.currentParticles as any).speedX = { min: 200, max: 400 };
        (this.currentParticles as any).speedY = { min: -20, max: 20 };
      }
    } else {
      this.currentParticles?.stop();
    }

    const { width } = this.scale;
    this.currentLabel = this.add
      .text(width / 2, 85, text, mono(12, color))
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);
    this.tweens.add({ targets: this.currentLabel, alpha: 0.8, duration: 300 });
    this.tweens.add({ targets: this.currentLabel, alpha: 0, duration: 1500, delay: 2500, onComplete: () => this.currentLabel?.destroy() });
  }

  // ── Redemoinho Duplo (M2) ─────────────────────────────────────

  private triggerWhirlpoolAttack(): void {
    if (this.isGameOver || this.finalBoss.isBossDefeated()) return;

    // 1. Mostrar aviso no centro da tela
    const radius = this.finalBoss.getIsPrime() ? 320 : 250;
    this.warningCircle = this.add.graphics().setDepth(2).setAlpha(0.1);
    this.warningCircle.fillStyle(0x00e5ff, 0.4);
    this.warningCircle.fillCircle(this.whirlpoolCenter.x, this.whirlpoolCenter.y, radius);
    this.warningCircle.lineStyle(3, 0x00e5ff, 1);
    this.warningCircle.strokeCircle(this.whirlpoolCenter.x, this.whirlpoolCenter.y, radius);

    this.tweens.add({
      targets: this.warningCircle,
      alpha: 0.4,
      duration: 250,
      yoyo: true,
      repeat: 3,
    });

    // 2. Transicionar chefes para o centro e começar giro
    this.tweens.add({
      targets: this.finalBoss,
      x: this.whirlpoolCenter.x,
      y: this.whirlpoolCenter.y,
      duration: 800,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        if (this.isGameOver || this.finalBoss.isBossDefeated()) {
          this.warningCircle?.destroy();
          return;
        }

        this.isWhirlpoolActive = true;
        this.warningCircle?.destroy();
        this.whirlpoolParticles?.start();

        // Chefes giram no centro
        this.tweens.add({
          targets: this.finalBoss,
          angle: 360,
          duration: 3000,
          onComplete: () => {
            this.finalBoss.setAngle(0);
            this.isWhirlpoolActive = false;
            this.whirlpoolParticles?.stop();

            // Retornar ao posto original
            this.tweens.add({
              targets: this.finalBoss,
              x: 1050,
              y: this.scale.height - 120,
              duration: 800,
              ease: 'Quad.easeInOut',
            });

            if (!this.isGameOver && !this.finalBoss.isBossDefeated()) {
              // Lançar Plankton em parábola (GDD)
              const throwDir = this.plankton.x > this.whirlpoolCenter.x ? -1 : 1;
              (this.plankton.body as Phaser.Physics.Arcade.Body).setVelocity(throwDir * 480, -360);
              
              if (this.plankton.receiveDamage(1)) {
                this.updateHUD();
              }

              // Ativar janela de vulnerabilidade (GDD: 2 segundos)
              this.finalBoss.setVulnerable(true);
              
              const vulnLabel = this.add
                .text(this.finalBoss.x, this.finalBoss.y - 120, '◆ VULNERÁVEL (DANO 2x) ◆', display(14, COLORS_CSS.gold))
                .setOrigin(0.5)
                .setDepth(15);
              
              this.tweens.add({
                targets: vulnLabel,
                y: vulnLabel.y - 15,
                duration: 2000,
                onComplete: () => {
                  vulnLabel.destroy();
                  this.finalBoss.setVulnerable(false);
                }
              });
            }
          }
        });
      }
    });
  }

  // ── Texturas Dinâmicas ────────────────────────────────────────

  private buildTextures(): void {
    const { width } = this.scale;

    if (!this.textures.exists('final-ground')) {
      const g = this.add.graphics();
      // Rocha oceânica profunda escura
      g.fillStyle(0x0c203a, 1);
      g.fillRect(0, 0, width, 50);
      g.fillStyle(0x1de9b6, 0.45); // Bioluminescência no topo
      g.fillRect(0, 0, width, 4);
      g.generateTexture('final-ground', width, 50);
      g.destroy();
    }

    if (!this.textures.exists('final-platform')) {
      const w = 240;
      const h = 26;
      const g = this.add.graphics();
      
      // Rocha indigo escura
      g.fillStyle(0x0d1b2a, 1);
      g.fillRoundedRect(0, 3, w, h - 3, 6);
      g.fillStyle(0x020813, 1);
      g.fillRoundedRect(0, h - 7, w, 7, { tl: 0, tr: 0, bl: 6, br: 6 });
      
      // Corais bioluminescentes
      g.fillStyle(0xff1744, 0.8); // coral vermelho
      g.fillCircle(30, 14, 3);
      g.fillCircle(190, 15, 4);
      g.fillStyle(0x00e5ff, 0.8); // coral ciano
      g.fillCircle(80, 12, 3);
      g.fillCircle(140, 16, 3.5);
      
      // Linha superior neon verde-água (GDD visual guide)
      g.fillStyle(0x1de9b6, 0.95);
      g.fillRoundedRect(0, 0, w, 4, { tl: 6, tr: 6, bl: 0, br: 0 });

      g.generateTexture('final-platform', w, h);
      g.destroy();
    }

    // Laser do Homem Sereia: cápsula verde
    if (!this.textures.exists('mermaid-ray')) {
      makeGlowCapsule(this, 'mermaid-ray', ATTACK_PALETTES.mermaidMan, 36, 10);
    }

    // Bolha do Mexilhãozinho: esfera azul
    if (!this.textures.exists('barnacle-bubble')) {
      makeGlowTexture(this, 'barnacle-bubble', ATTACK_PALETTES.barnacleBoy, 12);
    }
  }
}
