import * as Phaser from 'phaser';
import {
  COLORS,
  COLORS_CSS,
  caption,
  display,
  ensureFonts,
  fadeToScene,
  makeParticleDot,
  mono,
} from '../config/theme';

const BAR_W = 460;
const BAR_H = 14;
const MIN_DISPLAY_MS = 1200;

export class BootScene extends Phaser.Scene {
  public static nextScene: string | undefined = undefined;

  private fontsReady!: Promise<void>;
  private barFill!: Phaser.GameObjects.Rectangle;
  private percentText!: Phaser.GameObjects.Text;
  private fileText!: Phaser.GameObjects.Text;
  private startedAt = 0;
  private transitioning = false;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.startedAt = this.time.now;
    this.fontsReady = ensureFonts();
    this.buildLoadingScreen();

    // Barra reflete o progresso real do loader — tween, não set, para
    // continuar fluida mesmo com poucos arquivos pequenos
    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      this.tweens.add({
        targets: this.barFill,
        displayWidth: BAR_W * value,
        duration: 200,
        ease: 'Cubic.easeOut',
      });
      this.percentText.setText(`${Math.round(value * 100)}%`);
    });
    this.load.on(Phaser.Loader.Events.FILE_PROGRESS, (file: Phaser.Loader.File) => {
      this.fileText.setText(`▸ ${file.key}`);
    });

    // ── Sprites reais ─────────────────────────────────────────────
    // Cada frame é uma imagem separada (recorte exato do personagem) — fatiar
    // o spritesheet por largura fixa vazava pedaços do frame vizinho, porque
    // os personagens tinham espaçamento irregular na folha original.
    // O frame 0 é carregado sob a mesma chave que as cenas usavam para os
    // placeholders — os guards `if (!textures.exists(...))` então pulam a
    // geração do placeholder e o sprite real prevalece.
    this.load.image('plankton-placeholder', 'assets/plankton-walk-0.png');
    this.load.image('plankton-walk-1', 'assets/plankton-walk-1.png');
    this.load.image('plankton-walk-2', 'assets/plankton-walk-2.png');
    this.load.image('plankton-walk-3', 'assets/plankton-walk-3.png');
    this.load.image('bob-placeholder', 'assets/bob-walk-0.png');
    this.load.image('bob-walk-1', 'assets/bob-walk-1.png');
    this.load.image('bob-walk-2', 'assets/bob-walk-2.png');
    this.load.image('roboplankton', 'assets/roboplankton.png');
    this.load.image('patrick-boss', 'assets/patrick.png');
    this.load.image('sandy-boss',   'assets/sandy.png');
    this.load.image('lula-boss',    'assets/lula.png');
    this.load.image('mermaid-man-boss',  'assets/mermaid-man.png');
    this.load.image('barnacle-boy-boss', 'assets/barnacle-boy.png');
    this.load.image('bob-bubble',        'assets/bob-bubble.png');

    // ── Cenários reais (1280x720, recortados de docs/cenario_*.jpeg) ──
    this.load.image('bg-prologo', 'assets/bg-prologo.jpg');
    this.load.image('bg-patrick', 'assets/bg-patrick.jpg');
    this.load.image('bg-lula',    'assets/bg-lula.jpg');
    this.load.image('bg-sandy',   'assets/bg-sandy.jpg');
    this.load.image('bg-bob',     'assets/bg-bob.jpg');
    this.load.image('bob-surf',   'assets/surf-bg.png');

    // ── Fundos de cutscene/finais/escolha ──
    this.load.image('end-redencao', 'assets/end-redencao.jpg');
    this.load.image('end-traido',   'assets/end-traido.jpg');
    this.load.image('end-fantoche', 'assets/end-fantoche.jpg');
    this.load.image('cut-prologo',  'assets/cut-prologo.jpg');
    this.load.image('cut-patrick',  'assets/cut-patrick.jpg');
    this.load.image('skill-bg',     'assets/skill-bg.jpg');
    this.load.image('card-holandes', 'assets/card-holandes.jpg');
    this.load.image('card-bob',      'assets/card-bob.jpg');
  }

  // ── Tela de carregamento — estética "diário de mergulho" do menu ──

  private buildLoadingScreen(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add.rectangle(cx, cy, width, height, COLORS.bg);

    // Bolhas subindo — mesma ambientação do menu
    const dot = makeParticleDot(this);
    this.add.particles(0, 0, dot, {
      x: { min: 0, max: width },
      y: height + 12,
      lifespan: 5000,
      speedY: { min: -90, max: -40 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.4, end: 1.1 },
      alpha: { start: 0.3, end: 0 },
      tint: COLORS.cyan,
      frequency: 160,
    });

    const title = this.add
      .text(cx, cy - 90, 'FENDA DO BIQUINI', display(44))
      .setOrigin(0.5);
    this.tweens.add({
      targets: title,
      alpha: 0.85,
      scale: 1.02,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const sub = this.add
      .text(cx, cy - 40, '◆ SISTEMA DE MERGULHO — CARREGANDO RECURSOS', caption(11))
      .setOrigin(0.5);

    // Track arredondado da barra de progresso
    const track = this.add.graphics();
    track.fillStyle(COLORS.panelDark, 1);
    track.fillRoundedRect(cx - BAR_W / 2, cy + 10, BAR_W, BAR_H, BAR_H / 2);
    track.lineStyle(1, COLORS.cyan, 0.3);
    track.strokeRoundedRect(cx - BAR_W / 2, cy + 10, BAR_W, BAR_H, BAR_H / 2);

    this.barFill = this.add
      .rectangle(cx - BAR_W / 2 + 2, cy + 10 + BAR_H / 2, 0, BAR_H - 4, COLORS.gold)
      .setOrigin(0, 0.5);

    this.percentText = this.add
      .text(cx + BAR_W / 2, cy + 38, '0%', mono(12, COLORS_CSS.gold))
      .setOrigin(1, 0);
    this.fileText = this.add
      .text(cx - BAR_W / 2, cy + 38, '▸ iniciando…', mono(10, COLORS_CSS.textDim))
      .setOrigin(0, 0);

    // As fontes podem resolver no meio do loading — re-renderiza os textos
    // já criados para trocar o fallback pela fonte real
    const texts = [title, sub, this.percentText, this.fileText];
    this.fontsReady.then(() => {
      if (!this.scene.isActive('BootScene')) return;
      texts.forEach((t) => t.active && t.updateText());
    });
  }

  create(): void {
    // Frames em imagens separadas: não há mais vizinhos na textura para
    // "vazar" ao amostrar, então o filtro NEAREST deixou de ser necessário.

    // Animação de caminhada do Plankton — anims são globais a todas as cenas
    if (!this.anims.exists('plankton-walk')) {
      this.anims.create({
        key: 'plankton-walk',
        frames: [
          { key: 'plankton-placeholder' },
          { key: 'plankton-walk-1' },
          { key: 'plankton-walk-2' },
          { key: 'plankton-walk-3' },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }

    if (!this.anims.exists('bob-walk')) {
      // Ping-pong 0→1→2→1: só transições entre frames adjacentes = mais fluido
      this.anims.create({
        key: 'bob-walk',
        frames: [
          { key: 'bob-placeholder' },
          { key: 'bob-walk-1' },
          { key: 'bob-walk-2' },
          { key: 'bob-walk-1' },
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    // Sai quando: assets ok (já estamos no create) + fontes prontas +
    // tempo mínimo de exibição (sem flash de tela)
    const elapsed = this.time.now - this.startedAt;
    const minWait = new Promise<void>((resolve) =>
      this.time.delayedCall(Math.max(0, MIN_DISPLAY_MS - elapsed), () => resolve()),
    );

    Promise.all([this.fontsReady, minWait]).then(() => this.finish());
  }

  private finish(): void {
    if (this.transitioning) return;
    this.transitioning = true;

    this.percentText.setText('100%');
    this.fileText.setText('▸ pronto');
    this.tweens.add({
      targets: this.barFill,
      displayWidth: BAR_W - 4,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        // Flash gold na barra e mergulho para a cena selecionada
        this.tweens.add({
          targets: this.barFill,
          alpha: 0.4,
          duration: 90,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            const target = BootScene.nextScene || 'PrologoScene';
            BootScene.nextScene = undefined;
            fadeToScene(this, target, undefined, 450);
          },
        });
      },
    });
  }
}
