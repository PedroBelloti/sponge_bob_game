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

export const DIALOG_LULA: DialogConfig = {
  bossId: 'lula',
  speakerName: 'LULA MOLUSCO',
  lines: [
    'Plankton. Claro. Só você mesmo para interromper meu recital.',
    'Esse fragmento brilhante caiu no meu palco. Agora faz parte do espetáculo.',
    'Se o quer de volta, vai ter que aguentar a minha sinfonia.',
  ],
  choiceA: 'Você também sabe como é não pertencer a lugar nenhum, não sabe?',
  choiceB: 'Sua arte é medíocre e você sabe disso.',
  nextScene: 'Phase2Scene',
  nextSceneData: { bossDialogDone: true },
};

export const DIALOG_SANDY: DialogConfig = {
  bossId: 'sandy',
  speakerName: 'SANDY BOCHECHAS',
  lines: [
    'Plankton! Os sensores da cúpula detectaram algo pequeno se esgueirando.',
    'Esse fragmento da fórmula é fascinante. Energia molecular instável... estou estudando.',
    'Se o quer de volta, vai ter que provar sua hipótese. Na prática.',
  ],
  choiceA: 'Você é a única aqui que de fato me entende intelectualmente.',
  choiceB: 'Sua ciência não vale nada comparada à minha engenharia.',
  nextScene: 'Phase3Scene',
  nextSceneData: { bossDialogDone: true },
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

export const DIALOG_BOB: DialogConfig = {
  bossId: 'bob',
  speakerName: 'BOB ESPONJA',
  lines: [
    'Plankton! Você destruiu o Siri Cascudo e colocou a todos em perigo!',
    'Esse último fragmento da fórmula vai ficar guardado onde você nunca mais possa alcançá-lo.',
    'Sinto muito, mas não posso deixar você levar isso.',
  ],
  choiceA: 'Eu não queria que ninguém se machucasse lá dentro.',
  choiceB: 'Foi necessário. A fórmula era minha por direito.',
  nextScene: 'Phase4Scene',
  nextSceneData: { bossDialogDone: true },
};

