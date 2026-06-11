import * as Phaser from 'phaser';
import { GameState } from '../state/GameState';
import type { MoralPath } from '../state/GameState';
import {
  COLORS,
  COLORS_CSS,
  caption,
  display,
  fadeInScene,
  fadeToScene,
  makeParticleDot,
  mono,
} from '../config/theme';

const PATH_LABEL: Record<MoralPath, { text: string; color: string }> = {
  empatico: { text: 'Caminho Empático', color: COLORS_CSS.cyan },
  egoista:  { text: 'Caminho Egoísta',  color: COLORS_CSS.danger },
  neutro:   { text: 'Caminho Neutro',   color: COLORS_CSS.text },
};

export class DemoEndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DemoEndScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.getInstance().getData();
    const path = GameState.getInstance().getMoralPath();

    this.cameras.main.setBackgroundColor('#0a1833');
    fadeInScene(this, 600);

    // Bolhas ambiente — mesma linguagem do menu e do loading
    const dot = makeParticleDot(this);
    this.add.particles(0, 0, dot, {
      x: { min: 0, max: width },
      y: height + 12,
      lifespan: 6000,
      speedY: { min: -70, max: -30 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.3, end: 1 },
      alpha: { start: 0.25, end: 0 },
      tint: COLORS.cyan,
      frequency: 220,
    });

    const title = this.add
      .text(width / 2, height / 2 - 160, 'FRAGMENTO RECUPERADO', display(44))
      .setOrigin(0.5);
    this.tweens.add({
      targets: title,
      alpha: 0.85,
      scale: 1.02,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(width / 2, height / 2 - 112, '◆ FIM DA DEMO ◆', caption(13))
      .setOrigin(0.5);

    // Resumo do peso moral invisível (sem revelar bom/ruim — só o caminho)
    const label = PATH_LABEL[path];
    this.add
      .text(width / 2, height / 2 - 30, label.text, display(26, label.color))
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, `Escolhas registradas: ${state.choices.length}`, mono(14, COLORS_CSS.textDim))
      .setOrigin(0.5);

    const karenLine =
      path === 'empatico'
        ? '"Plankton... você está diferente. Isso é bom?"'
        : path === 'egoista'
          ? '"Foco no plano. Sentimentos são ineficientes."'
          : '"Processando... ainda não sei quem você está se tornando."';

    this.add
      .text(width / 2, height / 2 + 60, `KAREN: ${karenLine}`, {
        ...mono(14, COLORS_CSS.cyan),
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(
        width / 2,
        height / 2 + 150,
        '[ENTER] Rejogar do Prólogo    [1] Patrick    [2] Lula    [3] Sandy',
        mono(15, COLORS_CSS.gold),
      )
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.45,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.input.keyboard!.once('keydown-ENTER', () => {
      GameState.getInstance().reset();
      fadeToScene(this, 'PrologoScene');
    });
    this.input.keyboard!.once('keydown-ONE', () => {
      fadeToScene(this, 'Phase1Scene');
    });
    this.input.keyboard!.once('keydown-TWO', () => {
      fadeToScene(this, 'Phase2Scene');
    });
    this.input.keyboard!.once('keydown-THREE', () => {
      fadeToScene(this, 'Phase3Scene');
    });
  }
}
