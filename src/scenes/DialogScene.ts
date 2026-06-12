import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { ChoiceSystem } from '../systems/ChoiceSystem';
import type { BossId } from '../state/GameState';
import {
  COLORS,
  COLORS_CSS,
  caption,
  display,
  drawPanel,
  mono,
} from '../config/theme';

/** Fala narrativa (interlúdio da Karen/Narrador antes do confronto). */
export interface NarrativeLine {
  speaker: string;
  text: string;
}

export interface DialogConfig {
  bossId: BossId;
  speakerName: string;
  lines: string[];
  /** Interlúdio narrativo exibido ANTES das falas do boss (cada um c/ falante). */
  intro?: NarrativeLine[];
  /** Imagem de cutscene (chave de textura) exibida atrás do painel. */
  background?: string;
  choiceA: string;
  choiceB: string;
  nextScene: string;
  nextSceneData?: Record<string, unknown>;
}

const PANEL_W = 860;
const PANEL_H = 280;
const PANEL_X = CONSTANTS.GAME_WIDTH / 2;
const PANEL_Y = CONSTANTS.GAME_HEIGHT - 320 + PANEL_H / 2; // center of panel
const PAD = 20;
const TYPE_MS = 22; // mono lê rápido — 30ms arrastava

export class DialogScene extends Phaser.Scene {
  private cfg!: DialogConfig;

  // Typewriter state
  private segments: NarrativeLine[] = []; // interlúdio + falas do boss, unificados
  private currentLine = 0;
  private charIndex = 0;
  private fullText = '';
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private lineText!: Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private continuePrompt!: Phaser.GameObjects.Text;

  // Painel animável (abre/fecha como unidade)
  private panelRoot!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;

  // Choice state
  private choiceMode = false;
  private selected: 'A' | 'B' = 'A';
  private isConfirming = false;
  private optionABox!: Phaser.GameObjects.Graphics;
  private optionBBox!: Phaser.GameObjects.Graphics;
  private optionAWrap!: Phaser.GameObjects.Container;
  private optionBWrap!: Phaser.GameObjects.Container;
  private optionALabel!: Phaser.GameObjects.Text;
  private optionBLabel!: Phaser.GameObjects.Text;
  private choiceGroup: (Phaser.GameObjects.Container | Phaser.GameObjects.Text)[] = [];

  // Keys
  private enterKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'DialogScene' });
  }

  init(data: DialogConfig): void {
    this.cfg = data;
    // Interlúdio narrativo (cada fala c/ seu falante) + falas do boss
    this.segments = [
      ...(data.intro ?? []),
      ...data.lines.map((text) => ({ speaker: data.speakerName, text })),
    ];
    this.currentLine = 0;
    this.charIndex = 0;
    this.fullText = '';
    this.choiceMode = false;
    this.selected = 'A';
    this.isConfirming = false;
    this.typewriterTimer = null;
    this.choiceGroup = [];
  }

  create(): void {
    const W = CONSTANTS.GAME_WIDTH;
    const H = CONSTANTS.GAME_HEIGHT;

    // Cutscene (se houver): cobre a arena atrás do painel
    const hasBg = !!this.cfg.background && this.textures.exists(this.cfg.background);
    if (hasBg) {
      this.add.image(W / 2, H / 2, this.cfg.background!).setDepth(-1);
    }

    // Overlay esmaece em vez de cortar — mais leve quando há cutscene
    this.overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(0);
    this.tweens.add({ targets: this.overlay, fillAlpha: hasBg ? 0.35 : 0.7, duration: 240 });

    // Tudo do painel vive num Container — abre/fecha como uma unidade
    this.panelRoot = this.add.container(0, 0).setDepth(1);

    const panel = drawPanel(
      this,
      PANEL_X - PANEL_W / 2,
      PANEL_Y - PANEL_H / 2,
      PANEL_W,
      PANEL_H,
      { accent: true },
    );
    this.panelRoot.add(panel);

    const leftEdge = PANEL_X - PANEL_W / 2 + PAD + 6; // +6: barra de acento
    const topEdge  = PANEL_Y - PANEL_H / 2 + PAD;

    // Tag de transmissão + nome do falante (padrão do menu)
    const tag = this.add.text(leftEdge, topEdge - 4, '◆ TRANSMISSÃO', caption(10, COLORS_CSS.cyan));
    this.panelRoot.add(tag);

    this.speakerText = this.add.text(leftEdge, topEdge + 14, this.cfg.speakerName, display(20));
    this.panelRoot.add(this.speakerText);

    // Line text
    this.lineText = this.add.text(leftEdge, topEdge + 50, '', {
      ...mono(16),
      lineSpacing: 6,
      wordWrap: { width: PANEL_W - PAD * 2 - 6 },
    });
    this.panelRoot.add(this.lineText);

    // Continue prompt — pulsa suave, sem apagar de vez
    this.continuePrompt = this.add
      .text(PANEL_X + PANEL_W / 2 - PAD, PANEL_Y + PANEL_H / 2 - PAD, '[ENTER] ▶ continuar', mono(12, COLORS_CSS.cyan))
      .setOrigin(1, 1)
      .setVisible(false);
    this.panelRoot.add(this.continuePrompt);

    this.tweens.add({
      targets: this.continuePrompt,
      alpha: 0.35,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Choice UI (hidden initially)
    this.buildChoiceUI();

    // Animação de abertura: sobe + escala + fade, easing com leve overshoot
    this.panelRoot.setAlpha(0).setY(24).setScale(1, 0.92);
    this.tweens.add({
      targets: this.panelRoot,
      y: 0,
      alpha: 1,
      scaleY: 1,
      duration: 240,
      ease: 'Back.easeOut',
    });

    // Keys
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.leftKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    if (this.segments.length > 0) {
      this.showLine(0);
    } else {
      this.enterChoiceMode();
    }
  }

  // ── Typewriter ────────────────────────────────────────────────

  /** Cor do nome conforme o falante (narrativa lê melhor distinguindo vozes). */
  private speakerColor(name: string): string {
    const n = name.toUpperCase();
    if (n.includes('KAREN')) return COLORS_CSS.cyan;
    if (n.includes('PLANKTON')) return COLORS_CSS.success;
    if (n.includes('NARRADOR')) return COLORS_CSS.textDim;
    return COLORS_CSS.gold; // bosses e demais
  }

  private showLine(index: number): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
      this.typewriterTimer = null;
    }
    this.currentLine = index;
    const seg = this.segments[index];
    this.fullText = seg.text;
    this.speakerText.setText(seg.speaker).setColor(this.speakerColor(seg.speaker));
    this.charIndex = 0;
    this.lineText.setText('');
    this.continuePrompt.setVisible(false);

    this.typewriterTimer = this.time.addEvent({
      delay: TYPE_MS,
      repeat: this.fullText.length - 1,
      callback: () => {
        this.charIndex++;
        this.lineText.setText(this.fullText.slice(0, this.charIndex));
        if (this.charIndex >= this.fullText.length) {
          this.continuePrompt.setVisible(true);
        }
      },
    });
  }

  private advanceLine(): void {
    // First press: skip typewriter if still running
    if (this.charIndex < this.fullText.length) {
      this.typewriterTimer?.remove();
      this.typewriterTimer = null;
      this.charIndex = this.fullText.length;
      this.lineText.setText(this.fullText);
      this.continuePrompt.setVisible(true);
      return;
    }

    // Second press: advance to next line or choices
    const next = this.currentLine + 1;
    if (next < this.segments.length) {
      this.showLine(next);
    } else {
      this.enterChoiceMode();
    }
  }

  // ── Choices ───────────────────────────────────────────────────

  private static readonly CHOICE_W = 380;
  private static readonly CHOICE_H = 70;

  private drawChoiceBox(g: Phaser.GameObjects.Graphics, selected: boolean): void {
    const w = DialogScene.CHOICE_W;
    const h = DialogScene.CHOICE_H;
    g.clear();
    g.fillStyle(selected ? 0x2a2410 : 0x0a1f3c, 0.96);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(1.5, selected ? COLORS.gold : COLORS.cyan, selected ? 1 : 0.25);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  }

  private buildChoiceUI(): void {
    const centerY = PANEL_Y + 30;
    const boxW = DialogScene.CHOICE_W;

    const prompt = this.add
      .text(PANEL_X, PANEL_Y - 50, 'O que você faz?', display(16, COLORS_CSS.text))
      .setOrigin(0.5);

    // Cada opção vive num Container — a seleção desliza/escala como no menu
    this.optionABox = this.add.graphics();
    this.optionALabel = this.add
      .text(0, 0, this.cfg.choiceA, {
        ...mono(15),
        wordWrap: { width: boxW - PAD * 2 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.optionAWrap = this.add.container(PANEL_X - 200, centerY, [this.optionABox, this.optionALabel]);

    this.optionBBox = this.add.graphics();
    this.optionBLabel = this.add
      .text(0, 0, this.cfg.choiceB, {
        ...mono(15),
        wordWrap: { width: boxW - PAD * 2 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.optionBWrap = this.add.container(PANEL_X + 200, centerY, [this.optionBBox, this.optionBLabel]);

    this.choiceGroup = [prompt, this.optionAWrap, this.optionBWrap];
    this.choiceGroup.forEach((obj) => {
      obj.setVisible(false);
      this.panelRoot.add(obj);
    });
  }

  private enterChoiceMode(): void {
    this.choiceMode = true;
    this.lineText.setVisible(false);
    this.continuePrompt.setVisible(false);
    this.choiceGroup.forEach((obj) => obj.setVisible(true));
    this.updateOptionVisuals();
  }

  private updateOptionVisuals(): void {
    const aSelected = this.selected === 'A';
    this.drawChoiceBox(this.optionABox, aSelected);
    this.drawChoiceBox(this.optionBBox, !aSelected);
    this.optionALabel.setColor(aSelected ? COLORS_CSS.gold : COLORS_CSS.text);
    this.optionBLabel.setColor(aSelected ? COLORS_CSS.text : COLORS_CSS.gold);

    // A opção ativa "pisa à frente" — espelha a seleção do menu
    this.tweens.add({
      targets: this.optionAWrap,
      scale: aSelected ? 1.03 : 1,
      y: PANEL_Y + 30 + (aSelected ? -2 : 0),
      duration: 120,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: this.optionBWrap,
      scale: aSelected ? 1 : 1.03,
      y: PANEL_Y + 30 + (aSelected ? 0 : -2),
      duration: 120,
      ease: 'Quad.easeOut',
    });
  }

  // ── Confirm & transition ──────────────────────────────────────

  private confirmChoice(): void {
    if (this.isConfirming) return;
    this.isConfirming = true;

    ChoiceSystem.getInstance().registerChoice(this.cfg.bossId, this.selected);

    // Flash gold — mesma cor de confirmação do menu
    const flash = this.add
      .rectangle(PANEL_X, CONSTANTS.GAME_HEIGHT / 2, CONSTANTS.GAME_WIDTH, CONSTANTS.GAME_HEIGHT, COLORS.gold, 0)
      .setDepth(100);

    this.tweens.add({
      targets: flash,
      fillAlpha: 0.35,
      duration: 150,
      yoyo: true,
      onComplete: () => this.closePanel(() => this.transitionOut()),
    });
  }

  /** Fecha o painel (reverso da abertura) antes de sair de cena. */
  private closePanel(onDone: () => void): void {
    this.tweens.add({
      targets: this.panelRoot,
      y: 24,
      alpha: 0,
      scaleY: 0.92,
      duration: 160,
      ease: 'Quad.easeIn',
    });
    this.tweens.add({
      targets: this.overlay,
      fillAlpha: 0,
      duration: 160,
      onComplete: onDone,
    });
  }

  private transitionOut(): void {
    const { nextScene, nextSceneData } = this.cfg;
    const isResume = !!(nextSceneData as { bossDialogDone?: boolean } | undefined)?.bossDialogDone;

    if (isResume) {
      // Stop DialogScene first so its keyboard handlers are cleaned up,
      // then resume the paused scene cleanly on the next tick.
      this.scene.stop();
      this.scene.resume(nextScene);
    } else {
      this.scene.start(nextScene, nextSceneData);
    }
  }

  // ── Update ────────────────────────────────────────────────────

  update(): void {
    if (this.isConfirming) return;

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      if (this.choiceMode) {
        this.confirmChoice();
      } else {
        this.advanceLine();
      }
    }

    if (this.choiceMode) {
      if (Phaser.Input.Keyboard.JustDown(this.leftKey) && this.selected === 'B') {
        this.selected = 'A';
        this.updateOptionVisuals();
      }
      if (Phaser.Input.Keyboard.JustDown(this.rightKey) && this.selected === 'A') {
        this.selected = 'B';
        this.updateOptionVisuals();
      }
    }
  }
}
