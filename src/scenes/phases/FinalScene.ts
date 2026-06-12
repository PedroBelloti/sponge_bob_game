import * as Phaser from 'phaser';
import { CONSTANTS } from '../../config/constants';
import { FinalBoss } from '../../entities/bosses/FinalBoss';
import type { BaseBoss } from '../../entities/bosses/BaseBoss';
import type { DialogConfig } from '../DialogScene';
import { BossPhaseScene } from './BossPhaseScene';
import {
  ATTACK_PALETTES,
  COLORS,
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

  // Whirlpool (M2) state — sucção contínua que decai aos poucos após o uso
  private lastWhirlpoolTime: number = 0;
  private whirlpoolSpinning: boolean = false; // fase de sucção máxima (giro)
  private whirlpoolStrength: number = 0;       // 0..1; decai gradual após o giro
  private prevTime: number = 0;                // p/ dt do decaimento
  private whirlpoolCenter = { x: 640, y: 340 };
  private whirlpoolParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private whirlpoolSwirl: Phaser.GameObjects.Graphics | null = null;
  private static readonly WHIRLPOOL_WINDUP_MS = 2000; // telegrafo: param de atirar + giro

  // Barras de HP dos dois bosses (Homem Sereia, Mexilhãozinho)
  private barFills: Phaser.GameObjects.Rectangle[] = [];
  private barChips: Phaser.GameObjects.Rectangle[] = [];
  private static readonly DUO_BAR_W = 300;

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

    // Limites do mundo estendidos p/ queda livre nos buracos
    this.physics.world.setBounds(0, 0, width, height + 100);

    // Chão de rochas profundas com DOIS buracos (como na fase do Bob)
    this.ground = this.physics.add.staticGroup();
    const groundSeg = (cx: number, w: number) => {
      const g = this.ground.create(cx, height - 25, 'final-ground') as Phaser.Physics.Arcade.Sprite;
      g.setDisplaySize(w, 50).refreshBody();
    };
    groundSeg(200, 400);  // esquerda  [0..400]
    groundSeg(720, 360);  // centro    [540..900]  → buraco 1: [400..540]
    groundSeg(1160, 240); // direita   [1040..1280] → buraco 2: [900..1040]

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

  // Barra de suprema bem mais lenta na luta final (auto-cast esporádico)
  protected override supremeChargeScale(): number {
    return 0.35;
  }

  // Âncoras em grade (jogo da velha) só na luta final
  protected override useAnchorGrid(): boolean {
    return true;
  }

  // Laser preciso → atinge o combatente específico (não dano em área)
  protected override getBossHitTargets() {
    if (this.finalBoss.isBossDefeated()) return [];
    return this.finalBoss.getAliveTargets().map((t) => ({
      rect: t.rect,
      hit: (d: number) => this.finalBoss.hitCombatant(t.key, d),
    }));
  }

  // Duas barras de HP (uma por boss), em vez da barra única padrão
  protected override buildBossHpBar(width: number): void {
    const barW = FinalScene.DUO_BAR_W;
    const barH = 14;
    const y = 40;
    const positions = [width / 2 - barW - 24, width / 2 + 24]; // esquerda, direita
    this.finalBoss.getBarStates().forEach((s, i) => {
      const left = positions[i];
      this.add.text(left + barW / 2, y - 14, s.name, display(12, COLORS_CSS.text))
        .setOrigin(0.5, 1).setDepth(5);
      const track = this.add.graphics().setDepth(5);
      track.fillStyle(COLORS.panelDark, 0.85);
      track.fillRoundedRect(left, y - barH / 2, barW, barH, barH / 2);
      track.lineStyle(1, COLORS.cyan, 0.3);
      track.strokeRoundedRect(left, y - barH / 2, barW, barH, barH / 2);
      this.barChips[i] = this.add.rectangle(left + 2, y, barW - 4, barH - 6, 0xffffff, 0.5)
        .setOrigin(0, 0.5).setDepth(6);
      this.barFills[i] = this.add.rectangle(left + 2, y, barW - 4, barH - 6, s.color)
        .setOrigin(0, 0.5).setDepth(7);
    });
  }

  private updateBossBars(): void {
    const fullW = FinalScene.DUO_BAR_W - 4;
    this.finalBoss.getBarStates().forEach((s, i) => {
      const fill = this.barFills[i];
      const chip = this.barChips[i];
      if (!fill || !chip) return;
      fill.displayWidth = fullW * s.hpPct;
      if (!s.alive) fill.setFillStyle(0x44566a); // derrotado: cinza
      chip.displayWidth = Phaser.Math.Linear(chip.displayWidth, fullW * s.hpPct, 0.08);
    });
  }

  /** Sucção do redemoinho: forte, resistível remando (nunca vencível). */
  private applyWhirlpoolSuction(body: Phaser.Physics.Arcade.Body, strength: number): void {
    const dx = this.whirlpoolCenter.x - this.plankton.x;
    const dy = this.whirlpoolCenter.y - this.plankton.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const basePull = (this.finalBoss.getIsPrime() ? 520 : 420) * strength; // px/s p/ centro
    const radial = body.velocity.x * ux + body.velocity.y * uy; // + se já indo p/ centro
    const tx = body.velocity.x - radial * ux; // componente tangencial preservada
    const ty = body.velocity.y - radial * uy;
    const minPull = basePull * 0.25;
    // remar p/ fora (radial<0) reduz a sucção, mas nunca abaixo do mínimo
    const netRadial = Math.max(minPull, basePull + Math.min(0, radial));
    body.setVelocity(tx + ux * netRadial, ty + uy * netRadial);
  }

  // Sem diálogo interativo antes da luta final (GDD)
  protected getDialog(): DialogConfig {
    return {
      bossId: 'final',
      speakerName: 'HOMEM SEREIA',
      intro: [
        { speaker: 'NARRADOR', text: 'Os heróis da Fenda do Biquíni bloquearam o caminho.' },
        { speaker: 'KAREN', text: '"Independente do que acontecer agora... foi uma jornada e tanto para uma criatura do seu tamanho."' },
        { speaker: 'PLANKTON', text: '"Cala a boca, Karen."' },
      ],
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
    this.autoCastSupreme = true; // a suprema ativa sozinha ao encher
    this.lastWhirlpoolTime = this.time.now;
    this.whirlpoolSpinning = false;
    this.whirlpoolStrength = 0;

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
      this.whirlpoolSwirl?.destroy();
      if (this.physics?.world) {
        this.physics.world.setBounds(0, 0, CONSTANTS.GAME_WIDTH, CONSTANTS.GAME_HEIGHT);
      }
    });
  }

  protected onArenaUpdate(time: number): void {
    // 0. Cair num buraco = morte (como na fase do Bob)
    if (this.plankton.y > CONSTANTS.GAME_HEIGHT + 30 && !this.isGameOver) {
      this.plankton.receiveDamage(CONSTANTS.PLANKTON_MAX_HP);
      this.updateHUD();
    }

    // 1. Correntes marinhas: a da direita puxa bem mais forte; a da esquerda
    //    aparece às vezes e é mais branda.
    const body = this.plankton.body as Phaser.Physics.Arcade.Body;
    if (this.currentDirection === 'left') {
      body.setVelocityX(body.velocity.x - 85);
    } else if (this.currentDirection === 'right') {
      body.setVelocityX(body.velocity.x + 150);
    }

    // 2. Bolhas de Mexilhãozinho: teleguiadas por 3s (homeUntil), depois reto
    this.bossProjectilePool.getChildren().forEach((obj) => {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (p.active && p.visible && p.texture.key === 'barnacle-bubble') {
        const homeUntil = (p.getData('homeUntil') as number) ?? 0;
        if (time >= homeUntil) return; // janela de perseguição acabou → linha reta
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

    // 3. Sucção do redemoinho: forte durante o giro, depois decai aos poucos
    const dt = this.prevTime ? Math.min((time - this.prevTime) / 1000, 0.05) : 0;
    this.prevTime = time;
    if (this.whirlpoolStrength > 0) {
      this.applyWhirlpoolSuction(body, this.whirlpoolStrength);
      this.whirlpoolParticles?.setAlpha(Math.min(1, this.whirlpoolStrength + 0.15));
      if (!this.whirlpoolSpinning) {
        this.whirlpoolStrength = Math.max(0, this.whirlpoolStrength - dt / 2.5); // ~2.5s até sumir
        if (this.whirlpoolStrength === 0) this.whirlpoolParticles?.stop();
      }
    }

    // 4. Atualizar as duas barras de HP
    this.updateBossBars();

    // 5. Agendar próximo Redemoinho (só quando o anterior sumiu de vez)
    if (!this.whirlpoolSpinning && this.whirlpoolStrength <= 0 &&
        time - this.lastWhirlpoolTime >= this.finalBoss.getConfig().m2Cooldown) {
      this.lastWhirlpoolTime = time;
      this.triggerWhirlpoolAttack();
    }
  }

  // ── Correntes Marinhas ────────────────────────────────────────

  private cycleMarineCurrents(): void {
    if (this.isGameOver || this.finalBoss.isBossDefeated()) return;

    // Predominância para a DIREITA; esquerda às vezes; calmaria de vez em quando.
    const r = Math.random();
    this.currentDirection = r < 0.5 ? 'right' : r < 0.72 ? 'left' : 'none';

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

    // ── Telegrafo (~2s): os dois PARAM de atirar e um círculo d'água gira rápido ──
    this.finalBoss.setAttacksPaused(true);

    const swirl = this.buildWhirlpoolSwirl();
    this.whirlpoolSwirl = swirl;
    swirl.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: swirl, alpha: 1, scale: 1, duration: FinalScene.WHIRLPOOL_WINDUP_MS, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: swirl, angle: 360, duration: 360, repeat: -1 }); // gira rápido

    this.time.delayedCall(FinalScene.WHIRLPOOL_WINDUP_MS, () => this.startWhirlpoolSpin());
  }

  /** Após o telegrafo: chefes vão ao centro, giram e sugam. */
  private startWhirlpoolSpin(): void {
    this.finalBoss.setAttacksPaused(false); // fim do telegrafo; o giro já impede tiros
    if (this.isGameOver || this.finalBoss.isBossDefeated()) {
      this.fadeWhirlpoolSwirl();
      return;
    }

    this.tweens.add({
      targets: this.finalBoss,
      x: this.whirlpoolCenter.x,
      y: this.whirlpoolCenter.y,
      duration: 700,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        if (this.isGameOver || this.finalBoss.isBossDefeated()) {
          this.fadeWhirlpoolSwirl();
          return;
        }

        this.whirlpoolSpinning = true;
        this.whirlpoolStrength = 1;
        this.whirlpoolParticles?.start();

        // Chefes giram no centro
        this.tweens.add({
          targets: this.finalBoss,
          angle: 360,
          duration: 3000,
          onComplete: () => {
            this.finalBoss.setAngle(0);
            this.whirlpoolSpinning = false;
            this.whirlpoolStrength = 0; // janela de ejeção — sucção desligada
            this.whirlpoolParticles?.stop();
            this.fadeWhirlpoolSwirl();

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

              // Ao ser cuspido: só um POUCO mais lento (e nada de ficar preso)
              this.plankton.applySlowEffect(1100, 0.78);
              const slowLabel = this.add
                .text(this.plankton.x, this.plankton.y - 60, '◆ LENTO! ◆', display(13, COLORS_CSS.cyan))
                .setOrigin(0.5)
                .setDepth(15);
              this.tweens.add({
                targets: slowLabel,
                y: slowLabel.y - 18,
                alpha: 0,
                duration: 2000,
                onComplete: () => slowLabel.destroy(),
              });

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
              // Sem sucção residual: ao terminar, o Plankton fica livre na hora.
            }
          }
        });
      }
    });
  }

  /** Círculo de água girando (estilo onda do Bob, mas circular) — telegrafo. */
  private buildWhirlpoolSwirl(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(8);
    const D = Math.PI / 180;
    // Poça de água translúcida
    g.fillStyle(0x0c90e2, 0.16); g.fillCircle(0, 0, 92);
    g.fillStyle(0x42e0c7, 0.12); g.fillCircle(0, 0, 60);
    // Braços espirais (arcos abertos) em tons de água + brilho branco
    g.lineStyle(9, 0x0c90e2, 0.85); g.beginPath(); g.arc(0, 0, 82, 0, 250 * D, false); g.strokePath();
    g.lineStyle(8, 0x42e0c7, 0.90); g.beginPath(); g.arc(0, 0, 60, 120 * D, 360 * D, false); g.strokePath();
    g.lineStyle(5, 0xffffff, 0.50); g.beginPath(); g.arc(0, 0, 40, 60 * D, 320 * D, false); g.strokePath();
    g.lineStyle(3, 0xe0f7ff, 0.65); g.beginPath(); g.arc(0, 0, 82, 190 * D, 300 * D, false); g.strokePath();
    g.setPosition(this.whirlpoolCenter.x, this.whirlpoolCenter.y);
    return g;
  }

  private fadeWhirlpoolSwirl(): void {
    const s = this.whirlpoolSwirl;
    this.whirlpoolSwirl = null;
    if (!s) return;
    this.tweens.add({ targets: s, alpha: 0, scale: 1.5, duration: 500, onComplete: () => s.destroy() });
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
