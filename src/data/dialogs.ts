import type { DialogConfig } from '../scenes/DialogScene';

export const DIALOG_PROLOGO: DialogConfig = {
  bossId: 'prologo',
  speakerName: 'PLANKTON',
  lines: [
    'Eu consegui. A fórmula é minha.',
    'Mas aquele caos lá dentro...',
    'Será que alguém se machucou?',
  ],
  choiceA: 'Não era minha intenção ferir ninguém.',
  choiceB: 'Não importa. A fórmula é o que vale.',
  nextScene: 'Phase1Scene',
};

export const DIALOG_PATRICK: DialogConfig = {
  bossId: 'patrick',
  speakerName: 'PATRICK',
  lines: [
    'Ei! Você é aquele Plankton!',
    'Eu achei essa coisa brilhante caindo do céu.',
    'É minha agora!',
  ],
  choiceA: 'Ei Patrick, isso aí não é seu. Me dá de volta.',
  choiceB: 'Patrick, você quer brincar de pega-pega?',
  nextScene: 'Phase1Scene',
  nextSceneData: { bossDialogDone: true },
};
