import * as Phaser from 'phaser';
import { CONSTANTS } from '../config/constants';
import { ChoiceSystem } from '../systems/ChoiceSystem';
import type { BossId } from '../state/GameState';

export interface DialogConfig {
  bossId: BossId;
  speakerName: string;
  lines: string[];
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

export class DialogScene extends Phaser.Scene {
  private cfg!: DialogConfig;

  // Typewriter state
  private currentLine = 0;
  private charIndex = 0;
  private fullText = '';
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;
  private lineText!: Phaser.GameObjects.Text;
  private continuePrompt!: Phaser.GameObjects.Text;

  // Choice state
  private choiceMode = false;
  private selected: 'A' | 'B' = 'A';
  private isConfirming = false;
  private optionABox!: Phaser.GameObjects.Rectangle;
  private optionBBox!: Phaser.GameObjects.Rectangle;
  private optionALabel!: Phaser.GameObjects.Text;
  private optionBLabel!: Phaser.GameObjects.Text;
  private choiceGroup!: Phaser.GameObjects.Group;

  // Keys
  private enterKey!: Phaser.Input.Keyboard.Key;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'DialogScene' });
  }

  init(data: DialogConfig): void {
    this.cfg = data;
    this.currentLine = 0;
    this.charIndex = 0;
    this.fullText = '';
    this.choiceMode = false;
    this.selected = 'A';
    this.isConfirming = false;
    this.typewriterTimer = null;
  }

  create(): void {
    const W = CONSTANTS.GAME_WIDTH;
    const H = CONSTANTS.GAME_HEIGHT;

    // Semi-transparent overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(0);

    // Panel background
    this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x0d2137).setDepth(1);

    // Panel border
    const border = this.add.graphics().setDepth(1);
    border.lineStyle(2, 0x4fc3f7);
    border.strokeRect(PANEL_X - PANEL_W / 2, PANEL_Y - PANEL_H / 2, PANEL_W, PANEL_H);

    const leftEdge = PANEL_X - PANEL_W / 2 + PAD;
    const topEdge  = PANEL_Y - PANEL_H / 2 + PAD;

    // Speaker name
    this.add.text(leftEdge, topEdge, this.cfg.speakerName, {
      fontSize: '18px', color: '#FFD700', fontStyle: 'bold',
    }).setDepth(2);

    // Line text
    this.lineText = this.add.text(leftEdge, topEdge + 36, '', {
      fontSize: '16px', color: '#ECEFF1',
      wordWrap: { width: PANEL_W - PAD * 2 },
    }).setDepth(2);

    // Continue prompt (blinking)
    this.continuePrompt = this.add
      .text(PANEL_X + PANEL_W / 2 - PAD, PANEL_Y + PANEL_H / 2 - PAD, 'ENTER para continuar', {
        fontSize: '13px', color: '#4FC3F7',
      })
      .setOrigin(1, 1)
      .setDepth(2)
      .setVisible(false);

    this.tweens.add({
      targets: this.continuePrompt,
      alpha: 0,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Choice UI (hidden initially)
    this.choiceGroup = this.add.group();
    this.buildChoiceUI();

    // Keys
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.leftKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    if (this.cfg.lines.length > 0) {
      this.showLine(0);
    } else {
      this.enterChoiceMode();
    }
  }

  // ── Typewriter ────────────────────────────────────────────────

  private showLine(index: number): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
      this.typewriterTimer = null;
    }
    this.currentLine = index;
    this.fullText = this.cfg.lines[index];
    this.charIndex = 0;
    this.lineText.setText('');
    this.continuePrompt.setVisible(false);

    this.typewriterTimer = this.time.addEvent({
      delay: 30,
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
    if (next < this.cfg.lines.length) {
      this.showLine(next);
    } else {
      this.enterChoiceMode();
    }
  }

  // ── Choices ───────────────────────────────────────────────────

  private buildChoiceUI(): void {
    const centerY = PANEL_Y + 30;
    const boxW = 380;
    const boxH = 70;

    const prompt = this.add
      .text(PANEL_X, PANEL_Y - 50, 'O que você faz?', {
        fontSize: '16px', color: '#ECEFF1', fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setVisible(false);

    this.optionABox = this.add
      .rectangle(PANEL_X - 200, centerY, boxW, boxH, 0x1a3a5c)
      .setStrokeStyle(2, 0x2c4a6c)
      .setDepth(2);

    this.optionBBox = this.add
      .rectangle(PANEL_X + 200, centerY, boxW, boxH, 0x1a3a5c)
      .setStrokeStyle(2, 0x2c4a6c)
      .setDepth(2);

    this.optionALabel = this.add
      .text(PANEL_X - 200, centerY, this.cfg.choiceA, {
        fontSize: '15px', color: '#ECEFF1',
        wordWrap: { width: boxW - PAD * 2 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.optionBLabel = this.add
      .text(PANEL_X + 200, centerY, this.cfg.choiceB, {
        fontSize: '15px', color: '#ECEFF1',
        wordWrap: { width: boxW - PAD * 2 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.choiceGroup.addMultiple([
      prompt, this.optionABox, this.optionBBox,
      this.optionALabel, this.optionBLabel,
    ]);

    // Hidden until enterChoiceMode
    this.choiceGroup.setVisible(false);
  }

  private enterChoiceMode(): void {
    this.choiceMode = true;
    this.lineText.setVisible(false);
    this.continuePrompt.setVisible(false);
    this.choiceGroup.setVisible(true);
    this.updateOptionVisuals();
  }

  private updateOptionVisuals(): void {
    const aSelected = this.selected === 'A';
    this.optionABox.setStrokeStyle(2, aSelected ? 0xffd700 : 0x2c4a6c);
    this.optionBBox.setStrokeStyle(2, aSelected ? 0x2c4a6c : 0xffd700);
    this.optionALabel.setColor(aSelected ? '#FFD700' : '#ECEFF1');
    this.optionBLabel.setColor(aSelected ? '#ECEFF1' : '#FFD700');
  }

  // ── Confirm & transition ──────────────────────────────────────

  private confirmChoice(): void {
    if (this.isConfirming) return;
    this.isConfirming = true;

    ChoiceSystem.getInstance().registerChoice(this.cfg.bossId, this.selected);

    const flash = this.add
      .rectangle(PANEL_X, CONSTANTS.GAME_HEIGHT / 2, CONSTANTS.GAME_WIDTH, CONSTANTS.GAME_HEIGHT, 0xffffff, 0)
      .setDepth(100);

    this.tweens.add({
      targets: flash,
      alpha: 0.6,
      duration: 150,
      yoyo: true,
      onComplete: () => this.transitionOut(),
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
