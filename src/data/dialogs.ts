import type { DialogConfig } from '../scenes/DialogScene';

export const DIALOG_PROLOGO: DialogConfig = {
  bossId: 'prologo',
  speakerName: 'PLANKTON',
  background: 'cut-prologo',
  intro: [
    { speaker: 'NARRADOR', text: 'O robô destruiu mais do que o planejado. Clientes corriam. Destroços caíam.' },
    { speaker: 'NARRADOR', text: 'Plankton viu o caos e não conseguiu ignorar: não era assim que devia ser.' },
    { speaker: 'KAREN', text: '"Plankton. A fórmula. Foco."' },
    { speaker: 'NARRADOR', text: 'Ele pegou a fórmula e fugiu. Então o Homem Sereia e o Mexilhãozinho chegaram — o redemoinho implodiu o robô.' },
    { speaker: 'NARRADOR', text: 'A fórmula se fragmentou em pedaços espalhados pela Fenda do Biquíni. Plankton sobreviveu. Sozinho.' },
  ],
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
  intro: [
    { speaker: 'NARRADOR', text: 'O segundo fragmento estava no teatro do Lula. Naturalmente.' },
    { speaker: 'KAREN', text: '"Ele provavelmente está no meio de um monólogo. Timing perfeito para entrar."' },
    { speaker: 'NARRADOR', text: 'Lula passava os dias tocando para uma plateia vazia, sem reconhecimento, sem aplauso. Tinha algo familiar nisso.' },
    { speaker: 'KAREN', text: '"Não comece a se identificar com ele agora."' },
    { speaker: 'PLANKTON', text: '"Não estou me identificando. Vamos entrar."' },
  ],
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
  intro: [
    { speaker: 'NARRADOR', text: 'O terceiro fragmento estava na cúpula da Sandy. Ela com certeza já sabia.' },
    { speaker: 'KAREN', text: '"Sensores indicam que ela detectou sua presença há 4 minutos."' },
    { speaker: 'PLANKTON', text: '"Ela sempre me tratou como igual intelectualmente. Diferente dos outros."' },
    { speaker: 'KAREN', text: '"E mesmo assim você vai invadir o laboratório dela."' },
    { speaker: 'PLANKTON', text: '"A fórmula não se reúne sozinha, Karen."' },
    { speaker: 'KAREN', text: '"Não. Não se reúne."' },
  ],
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
  background: 'cut-patrick',
  intro: [
    { speaker: 'NARRADOR', text: 'O primeiro fragmento da fórmula estava perto da pedra do Patrick. Claro.' },
    { speaker: 'KAREN', text: '"Sinal forte embaixo da pedra dele. Ele provavelmente nem sabe que está lá."' },
    { speaker: 'PLANKTON', text: '"Patrick nunca sabe de nada."' },
    { speaker: 'NARRADOR', text: 'Mas ao se aproximar, Plankton pensou: Patrick era o único na Fenda do Biquíni que nunca o olhou com desdém. Só com confusão. Ainda assim — a fórmula vinha primeiro.' },
  ],
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
  intro: [
    { speaker: 'NARRADOR', text: 'O último fragmento estava nas ruínas do Siri Cascudo. E Bob estava lá, guardando.' },
    { speaker: 'KAREN', text: '"Ele sabe que você vai aparecer. Ficou esperando."' },
    { speaker: 'NARRADOR', text: 'Plankton olhou para as ruínas. Era culpa sua. O lugar onde Bob passava cada dia de sua vida estava destruído por causa dele.' },
  ],
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

