import * as Phaser from 'phaser';
import { GameState } from '../state/GameState';
import type { MoralPath } from '../state/GameState';

const PATH_LABEL: Record<MoralPath, { text: string; color: string }> = {
  empatico: { text: 'Caminho Empático', color: '#4FC3F7' },
  egoista:  { text: 'Caminho Egoísta',  color: '#FF1744' },
  neutro:   { text: 'Caminho Neutro',   color: '#ECEFF1' },
};

export class DemoEndScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DemoEndScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const state = GameState.getInstance().getData();
    const path = GameState.getInstance().getMoralPath();

    this.cameras.main.setBackgroundColor('#0a1628');
    this.cameras.main.fadeIn(600, 0, 0, 0);

    this.add
      .text(width / 2, height / 2 - 160, 'FRAGMENTO RECUPERADO', {
        fontSize: '40px', color: '#FFD700', fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 110, '— FIM DA DEMO —', {
        fontSize: '20px', color: '#ECEFF1',
      })
      .setOrigin(0.5);

    // Resumo do peso moral invisível (sem revelar bom/ruim — só o caminho)
    const label = PATH_LABEL[path];
    this.add
      .text(width / 2, height / 2 - 30, label.text, {
        fontSize: '26px', color: label.color, fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, `Escolhas registradas: ${state.choices.length}`, {
        fontSize: '16px', color: '#8D6E63',
      })
      .setOrigin(0.5);

    const karenLine =
      path === 'empatico'
        ? '"Plankton... você está diferente. Isso é bom?"'
        : path === 'egoista'
          ? '"Foco no plano. Sentimentos são ineficientes."'
          : '"Processando... ainda não sei quem você está se tornando."';

    this.add
      .text(width / 2, height / 2 + 60, `KAREN: ${karenLine}`, {
        fontSize: '15px', color: '#4FC3F7', fontStyle: 'italic',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(width / 2, height / 2 + 150, 'ENTER  Rejogar desde o Prólogo      1  Fase 1 (Patrick)      2  Fase 2 (Lula)', {
        fontSize: '16px', color: '#FFD700',
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard!.once('keydown-ENTER', () => {
      GameState.getInstance().reset();
      this.scene.start('PrologoScene');
    });
    this.input.keyboard!.once('keydown-ONE', () => {
      this.scene.start('Phase1Scene');
    });
    this.input.keyboard!.once('keydown-TWO', () => {
      this.scene.start('Phase2Scene');
    });
  }
}
