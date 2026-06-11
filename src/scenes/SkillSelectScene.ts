import * as Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { ChoiceSystem } from '../systems/ChoiceSystem';
import { SaveManager } from '../state/SaveManager';
import {
  COLORS,
  COLORS_CSS,
  display,
  mono,
  drawPanel,
  fadeInScene,
  fadeToScene,
  makeParticleDot,
} from '../config/theme';
import { CONSTANTS } from '../config/constants';

const W = CONSTANTS.GAME_WIDTH;
const H = CONSTANTS.GAME_HEIGHT;

export class SkillSelectScene extends Phaser.Scene {
  private isBobAvailable = false;
  private selected: 'holandes' | 'bob' = 'holandes';
  private confirmed = false;

  // UI Elements
  private dialogText!: Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private continuePrompt!: Phaser.GameObjects.Text;

  // Cards
  private leftCardBox!: Phaser.GameObjects.Graphics;
  private leftCardContainer!: Phaser.GameObjects.Container;
  private rightCardBox!: Phaser.GameObjects.Graphics;
  private rightCardContainer!: Phaser.GameObjects.Container;

  // Typewriter
  private currentDialogIndex = 0;
  private charIndex = 0;
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private dialogLines: { speaker: string; text: string }[] = [];
  private inChoiceMode = false;

  // Keys
  private enterKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'SkillSelectScene' });
  }

  create(): void {
    fadeInScene(this, 600);
    this.confirmed = false;
    this.inChoiceMode = false;
    this.currentDialogIndex = 0;

    this.isBobAvailable = ChoiceSystem.getInstance().canBobOfferAlliance();
    this.selected = 'holandes';

    // ── Ambient background ──
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.bg);

    // Split background visual theme
    // Left side green gradient (Holandês)
    const leftGlow = this.add.graphics();
    leftGlow.fillGradientStyle(0x0a2d1e, 0x05142e, 0x0a2d1e, 0x05142e, 0.45);
    leftGlow.fillRect(0, 0, W / 2, H);

    // Right side cyan/yellow gradient (Bob)
    const rightGlow = this.add.graphics();
    rightGlow.fillGradientStyle(0x05142e, this.isBobAvailable ? 0x2e270a : 0x05142e, 0x05142e, this.isBobAvailable ? 0x2e270a : 0x05142e, 0.45);
    rightGlow.fillRect(W / 2, 0, W / 2, H);

    // Partition line
    const divider = this.add.graphics();
    divider.lineStyle(1.5, COLORS.cyan, 0.08);
    divider.lineBetween(W / 2, 0, W / 2, H);

    // ── Floating Particles (Juice!) ──
    const dotTex = makeParticleDot(this);

    // Left side: green spectral sparks
    this.add.particles(0, 0, dotTex, {
      x: { min: 0, max: W / 2 },
      y: { min: 0, max: H },
      lifespan: { min: 3000, max: 6000 },
      speedY: { min: -40, max: -15 },
      scale: { start: 0.5, end: 1.5 },
      alpha: { start: 0.15, end: 0 },
      tint: 0x6fff8a,
      frequency: 250,
    });

    // Right side: cyan bubbles (or dimmed if Bob locked)
    this.add.particles(0, 0, dotTex, {
      x: { min: W / 2, max: W },
      y: H + 10,
      lifespan: { min: 3500, max: 5500 },
      speedY: { min: -60, max: -20 },
      scale: { start: 0.6, end: 1.8 },
      alpha: { start: this.isBobAvailable ? 0.25 : 0.05, end: 0 },
      tint: this.isBobAvailable ? COLORS.cyan : 0x7d93b3,
      frequency: this.isBobAvailable ? 200 : 800,
    });

    // ── Dialogue lines setup ──
    this.dialogLines = [
      {
        speaker: 'SISTEMA',
        text: 'O Siri Cascudo está em ruínas. Plankton recolhe o último fragmento, mas a poeira assenta e duas presenças surgem de lados opostos.',
      },
      {
        speaker: 'HOLANDÊS VOADOR',
        text: '"Aceite meu Pacto, criatura insignificante! Eu lhe concederei as ÂNCORAS AMALDIÇOADAS e poder brutal. Mas ao final, sua alma e a fórmula me pertencerão!"',
      },
    ];

    if (this.isBobAvailable) {
      this.dialogLines.push({
        speaker: 'BOB ESPONJA',
        text: '"Plankton, eu perdoo você pelo que houve. Juntos podemos vencer a ameaça final. Não exijo almas ou pactos, apenas sua amizade e o poder da ONDA DE SURF!"',
      });
    } else {
      this.dialogLines.push({
        speaker: 'SISTEMA',
        text: 'Bob Esponja observa Plankton com desconfiança e recusa-se a ajudá-lo devido ao seu histórico de egoísmo e maldade. O pacto com o Holandês Voador é compulsório.',
      });
    }

    // ── Build Dialog Panel ──
    drawPanel(this, 160, 480, 960, 200, { accent: true });
    
    this.speakerText = this.add.text(180, 496, '', display(15, COLORS_CSS.cyan));
    
    this.dialogText = this.add.text(180, 526, '', {
      ...mono(14),
      lineSpacing: 6,
      wordWrap: { width: 920 },
    });

    this.continuePrompt = this.add
      .text(1100, 650, '[ENTER] ▶ continuar', mono(11, COLORS_CSS.cyan))
      .setOrigin(1, 1)
      .setVisible(false);

    this.tweens.add({
      targets: this.continuePrompt,
      alpha: 0.35,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Build Cards ──
    this.buildCards();

    // ── Keys ──
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.leftKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    this.playDialogue(0);
  }

  private buildCards(): void {
    const cardW = 340;
    const cardH = 260;
    const cardY = 250;

    // LEFT CARD — Holandês
    this.leftCardBox = this.add.graphics();
    this.drawCard(this.leftCardBox, 0, 0, cardW, cardH, true, false, 0x6fff8a);

    const leftTitle = this.add.text(0, -90, 'HOLANDÊS VOADOR', display(18, '#6fff8a')).setOrigin(0.5);
    const leftSkill = this.add.text(0, -55, '▲ ÂNCORAS AMALDIÇOADAS', mono(12, COLORS_CSS.gold)).setOrigin(0.5);
    
    const leftDesc = this.add.text(0, -10, 'Suprema ofensiva devastadora.\nChove 4 âncoras gigantes do céu\ncausando dano massivo no impacto.', {
      ...mono(11, '#e8f4ff'),
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    const leftWarning = this.add.text(0, 50, '◆ CAMINHO EGOÍSTA / FANTOCHE', mono(11, COLORS_CSS.orange)).setOrigin(0.5);
    const leftAction = this.add.text(0, 95, '[ AVALIAR PACTO ]', display(13, '#6fff8a')).setOrigin(0.5);

    this.leftCardContainer = this.add.container(W / 2 - 240, cardY, [
      this.leftCardBox,
      leftTitle,
      leftSkill,
      leftDesc,
      leftWarning,
      leftAction,
    ]);
    this.leftCardContainer.setVisible(false);

    // Make Left Card interactive via mouse
    this.leftCardBox.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
    this.leftCardBox.on('pointerdown', () => {
      if (!this.inChoiceMode || this.confirmed) return;
      this.selected = 'holandes';
      this.updateCardVisuals();
      this.confirmSelection();
    });
    this.leftCardBox.on('pointerover', () => {
      if (!this.inChoiceMode || this.confirmed) return;
      this.selected = 'holandes';
      this.updateCardVisuals();
    });

    // RIGHT CARD — Bob Esponja
    this.rightCardBox = this.add.graphics();
    this.drawCard(this.rightCardBox, 0, 0, cardW, cardH, false, !this.isBobAvailable, 0xffd400);

    const rightTitle = this.add.text(0, -90, 'BOB ESPONJA', display(18, this.isBobAvailable ? '#ffd400' : '#55667d')).setOrigin(0.5);
    const rightSkill = this.add.text(0, -55, '▲ ONDA DE SURF', mono(12, this.isBobAvailable ? COLORS_CSS.cyan : '#55667d')).setOrigin(0.5);
    
    const rightDesc = this.add.text(0, -10, this.isBobAvailable 
      ? 'Bob surge com sua prancha e\numa onda gigante varre a arena,\ndestruindo projéteis e causando dano.'
      : 'Bob não confia em você.\nSua ajuda está bloqueada para\nesta rodada.', {
      ...mono(11, this.isBobAvailable ? '#e8f4ff' : '#55667d'),
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    const rightWarning = this.add.text(0, 50, this.isBobAvailable ? '◆ CAMINHO EMPÁTICO / REDENÇÃO' : '◆ ALIANÇA INDISPONÍVEL', mono(11, this.isBobAvailable ? COLORS_CSS.success : '#55667d')).setOrigin(0.5);
    const rightAction = this.add.text(0, 95, this.isBobAvailable ? '[ ACEITAR ALIANÇA ]' : '[ REJEITADO ]', display(13, this.isBobAvailable ? '#ffd400' : '#55667d')).setOrigin(0.5);

    this.rightCardContainer = this.add.container(W / 2 + 240, cardY, [
      this.rightCardBox,
      rightTitle,
      rightSkill,
      rightDesc,
      rightWarning,
      rightAction,
    ]);
    this.rightCardContainer.setVisible(false);

    // Make Right Card interactive via mouse (only if unlocked)
    if (this.isBobAvailable) {
      this.rightCardBox.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
      this.rightCardBox.on('pointerdown', () => {
        if (!this.inChoiceMode || this.confirmed) return;
        this.selected = 'bob';
        this.updateCardVisuals();
        this.confirmSelection();
      });
      this.rightCardBox.on('pointerover', () => {
        if (!this.inChoiceMode || this.confirmed) return;
        this.selected = 'bob';
        this.updateCardVisuals();
      });
    }
  }

  private drawCard(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
    locked: boolean,
    color: number
  ): void {
    g.clear();
    if (locked) {
      // Locked state: dark, low opacity border
      g.fillStyle(0x051026, 0.85);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      g.lineStyle(1.5, 0x475975, 0.2);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    } else {
      // Active state
      g.fillStyle(selected ? 0x0b2547 : 0x051326, 0.93);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);

      const alpha = selected ? 1.0 : 0.25;
      const strokeW = selected ? 2.5 : 1.5;
      g.lineStyle(strokeW, color, alpha);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    }
  }

  // ── Dialogue Typewriter ──

  private playDialogue(index: number): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
      this.typewriterTimer = null;
    }

    this.currentDialogIndex = index;
    const line = this.dialogLines[index];
    this.speakerText.setText(`◆ ${line.speaker}`);
    this.charIndex = 0;
    this.dialogText.setText('');
    this.continuePrompt.setVisible(false);

    this.typewriterTimer = this.time.addEvent({
      delay: 20,
      repeat: line.text.length - 1,
      callback: () => {
        this.charIndex++;
        this.dialogText.setText(line.text.slice(0, this.charIndex));
        if (this.charIndex >= line.text.length) {
          this.continuePrompt.setVisible(true);
        }
      },
    });
  }

  private advanceDialogue(): void {
    const line = this.dialogLines[this.currentDialogIndex];
    if (this.charIndex < line.text.length) {
      // Skip typing animation
      this.typewriterTimer?.remove();
      this.typewriterTimer = null;
      this.charIndex = line.text.length;
      this.dialogText.setText(line.text);
      this.continuePrompt.setVisible(true);
      return;
    }

    const next = this.currentDialogIndex + 1;
    if (next < this.dialogLines.length) {
      this.playDialogue(next);
    } else {
      this.enterChoiceMode();
    }
  }

  private enterChoiceMode(): void {
    this.inChoiceMode = true;
    this.dialogText.setText('Selecione a Suprema que guiará seu mergulho final:');
    this.speakerText.setText('◆ ARQUIVISTA DE HABILIDADES');
    this.continuePrompt.setVisible(false);

    this.leftCardContainer.setVisible(true);
    this.rightCardContainer.setVisible(true);

    this.updateCardVisuals();
  }

  private updateCardVisuals(): void {
    const cardW = 340;
    const cardH = 260;

    const isLeft = this.selected === 'holandes';

    this.drawCard(this.leftCardBox, 0, 0, cardW, cardH, isLeft, false, 0x6fff8a);
    this.drawCard(this.rightCardBox, 0, 0, cardW, cardH, !isLeft, !this.isBobAvailable, 0xffd400);

    // Apply scale tween for active card
    this.tweens.add({
      targets: this.leftCardContainer,
      scale: isLeft ? 1.04 : 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });

    this.tweens.add({
      targets: this.rightCardContainer,
      scale: (!isLeft && this.isBobAvailable) ? 1.04 : 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  private confirmSelection(): void {
    if (this.confirmed) return;
    this.confirmed = true;

    // Register selection to GameState
    GameState.getInstance().unlockSkill(this.selected);
    SaveManager.getInstance().save();

    // Confirm visual effect
    const flashColor = this.selected === 'holandes' ? 0x6fff8a : 0xffd400;
    const flash = this.add
      .rectangle(W / 2, H / 2, W, H, flashColor, 0)
      .setDepth(100);

    this.cameras.main.flash(400, (flashColor >> 16) & 0xff, (flashColor >> 8) & 0xff, flashColor & 0xff);

    this.tweens.add({
      targets: flash,
      fillAlpha: 0.3,
      duration: 200,
      yoyo: true,
      onComplete: () => {
        // Transition to FinalScene
        fadeToScene(this, 'FinalScene', undefined, 500);
      },
    });
  }

  update(): void {
    if (this.confirmed) return;

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      if (this.inChoiceMode) {
        this.confirmSelection();
      } else {
        this.advanceDialogue();
      }
    }

    if (this.inChoiceMode) {
      if (Phaser.Input.Keyboard.JustDown(this.leftKey) && this.selected === 'bob') {
        this.selected = 'holandes';
        this.updateCardVisuals();
      }
      if (Phaser.Input.Keyboard.JustDown(this.rightKey) && this.selected === 'holandes' && this.isBobAvailable) {
        this.selected = 'bob';
        this.updateCardVisuals();
      }
    }
  }
}
