import * as Phaser from 'phaser';
import { GameState } from '../state/GameState';
import type { EndingId } from '../state/GameState';
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

interface EndingConfig {
  title: string;
  color: string;
  paragraphs: string[];
}

const ENDING_DETAILS: Record<EndingId, EndingConfig> = {
  'redencao': {
    title: '◆ FINAL A — REDENÇÃO ◆',
    color: COLORS_CSS.cyan,
    paragraphs: [
      'Plankton derrotou os heróis com Bob Esponja lutando ao seu lado.',
      'Com a fórmula finalmente reunida, a verdade sobre aquela terrível noite é revelada...',
      'Os clientes do Siri Cascudo NÃO MORRERAM! Sandy havia ativado uma bolha de proteção molecular instantes antes dos destroços atingirem o chão.',
      'Reconhecendo o arrependimento sincero de Plankton, Bob Esponja, Patrick, Lula Molusco e Sandy estendem a mão em sinal de paz.',
      'Ele não precisa mais governar os mares pelo medo. Plankton finalmente encontrou o seu lugar na Fenda do Biquíni.',
      'Ele não está mais fora do cardume.',
    ],
  },
  'desejo-traido': {
    title: '◆ FINAL B — O DESEJO TRAÍDO ◆',
    color: COLORS_CSS.orange,
    paragraphs: [
      'Plankton venceu a batalha final empunhando o assustador poder do Holandês Voador.',
      'O pacto exigia que ele usasse a fórmula restaurada para espalhar o terror e governar os 7 mares sob o comando do fantasma.',
      'No entanto, olhando para a Fenda do Biquíni devastada, Plankton usa o desejo final da fórmula para reviver todos os clientes.',
      'O Holandês Voador, enfurecido pela traição mas obrigado a honrar o contrato do pacto, vai embora jurando vingança.',
      'Plankton fica sozinho sob as ruínas do restaurante, segurando a fórmula.',
      'Ele fez a coisa certa, pelo caminho mais difícil. Mas ele está sozinho... e o perdão ainda parece um sonho distante.',
    ],
  },
  'fantoche': {
    title: '◆ FINAL C — O FANTOCHE ◆',
    color: COLORS_CSS.danger,
    paragraphs: [
      'A Fenda do Biquíni jaz em silêncio. As vidas perdidas no Siri Cascudo nunca mais retornarão.',
      'Sem opções e guiado pelo puro egoísmo, o pacto com o Holandês Voador tornou-se compulsório para Plankton.',
      'Com a fórmula reunida, o Holandês cobra seu preço: as almas de Bob Esponja, Patrick, Lula Molusco e Sandy são seladas no Navio Fantasma.',
      'Plankton governa os mares do topo de um trono de metal e cinzas, ao lado do capitão espectral.',
      'Ele tem a fórmula. Ele tem o poder supremo que sempre sonhou...',
      'Mas ao olhar ao seu redor, ele percebe que venceu... e acabou mais sozinho do que nunca.',
    ],
  },
};

export class EndingScene extends Phaser.Scene {
  private endingId!: EndingId;
  private cfg!: EndingConfig;

  private currentPara = 0;
  private charIndex = 0;
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;

  private paraText!: Phaser.GameObjects.Text;
  private continuePrompt!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private cardRoot!: Phaser.GameObjects.Container;
  private isCreditsScroll = false;

  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'EndingScene' });
  }

  init(data: { endingId?: EndingId }): void {
    const determined = GameState.getInstance().determineEnding();
    this.endingId = data?.endingId ?? determined;
    this.cfg = ENDING_DETAILS[this.endingId];
    this.currentPara = 0;
    this.charIndex = 0;
    this.typewriterTimer = null;
    this.isCreditsScroll = false;
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#040a18');
    fadeInScene(this, 800);

    // Fundo ilustrado do final + scrim escuro p/ o texto continuar legível.
    // No Final C (fantoche), o texto/créditos passam sobre a FENDA DESTRUÍDA
    // com um lento afastamento (zoom-out); o trono só aparece no fim.
    const isFantoche = this.endingId === 'fantoche';
    const bgKey = isFantoche ? 'end-traido' : ({
      'redencao': 'end-redencao',
      'desejo-traido': 'end-traido',
      'fantoche': 'end-traido',
    } as Record<EndingId, string>)[this.endingId];

    if (bgKey && this.textures.exists(bgKey)) {
      const bg = this.add.image(width / 2, height / 2, bgKey).setDepth(-10);
      if (isFantoche) {
        // Cobre com margem (sem bordas) e dá um zoom-out: começa MAIOR e
        // vai ao normal, dando a impressão de a câmera se afastar do centro.
        bg.setDisplaySize(width * 1.08, height * 1.08);
        const baseSX = bg.scaleX, baseSY = bg.scaleY;
        bg.setScale(baseSX * 1.2, baseSY * 1.2);
        this.tweens.add({
          targets: bg,
          scaleX: baseSX, scaleY: baseSY,
          duration: 24000,
          ease: 'Sine.easeOut',
        });
      }
      this.add.rectangle(width / 2, height / 2, width, height, 0x040a18, 0.62).setDepth(-9);
    }

    // Efeito de partículas (bolhas flutuantes)
    const dot = makeParticleDot(this);
    this.add.particles(0, 0, dot, {
      x: { min: 0, max: width },
      y: height + 10,
      lifespan: 7000,
      speedY: { min: -60, max: -25 },
      speedX: { min: -5, max: 5 },
      scale: { start: 0.3, end: 1.0 },
      alpha: { start: 0.3, end: 0 },
      tint: COLORS.cyan,
      frequency: 200,
    });

    // Container central do cartão narrativo
    this.cardRoot = this.add.container(width / 2, height / 2).setDepth(10);

    // Título do final
    this.titleText = this.add
      .text(0, -140, this.cfg.title, display(32, this.cfg.color))
      .setOrigin(0.5);
    this.cardRoot.add(this.titleText);

    // Texto de parágrafo
    this.paraText = this.add
      .text(0, -10, '', {
        ...mono(16, COLORS_CSS.text),
        align: 'center',
        lineSpacing: 10,
        wordWrap: { width: 780 },
      })
      .setOrigin(0.5);
    this.cardRoot.add(this.paraText);

    // Prompt de avanço
    this.continuePrompt = this.add
      .text(0, 150, '[ENTER] ▶ continuar', mono(13, COLORS_CSS.gold))
      .setOrigin(0.5)
      .setAlpha(0);
    this.cardRoot.add(this.continuePrompt);

    this.tweens.add({
      targets: this.continuePrompt,
      alpha: 0.85,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.showParagraph(0);
  }

  private showParagraph(index: number): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
      this.typewriterTimer = null;
    }
    
    this.currentPara = index;
    const fullText = this.cfg.paragraphs[index];
    this.charIndex = 0;
    this.paraText.setText('');
    this.continuePrompt.setVisible(false);

    this.typewriterTimer = this.time.addEvent({
      delay: 26,
      repeat: fullText.length - 1,
      callback: () => {
        this.charIndex++;
        this.paraText.setText(fullText.slice(0, this.charIndex));
        if (this.charIndex >= fullText.length) {
          this.continuePrompt.setVisible(true);
        }
      },
    });
  }

  private advance(): void {
    const fullText = this.cfg.paragraphs[this.currentPara];
    // Se o typewriter ainda está escrevendo, pula ele e exibe tudo
    if (this.charIndex < fullText.length) {
      this.typewriterTimer?.remove();
      this.typewriterTimer = null;
      this.charIndex = fullText.length;
      this.paraText.setText(fullText);
      this.continuePrompt.setVisible(true);
      return;
    }

    const next = this.currentPara + 1;
    if (next < this.cfg.paragraphs.length) {
      this.showParagraph(next);
    } else {
      this.startCredits();
    }
  }

  private startCredits(): void {
    this.isCreditsScroll = true;
    
    this.tweens.add({
      targets: this.cardRoot,
      alpha: 0,
      y: this.scale.height / 2 - 100,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.cardRoot.destroy();
        this.showCreditsScreen();
      },
    });
  }

  private showCreditsScreen(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    const creditsGroup = this.add.container(cx, height + 50).setDepth(20);

    const title = this.add.text(0, 0, 'FORA DO CARDUME', display(36, COLORS_CSS.gold)).setOrigin(0.5);
    const sub = this.add.text(0, 40, '◆ CRÉDITOS ◆', caption(12, COLORS_CSS.cyan)).setOrigin(0.5);

    const programmers = this.add.text(0, 120, 'PROGRAMAÇÃO & SISTEMAS\nAntigravity AI Pair Programmer', {
      ...mono(14, COLORS_CSS.text),
      align: 'center',
    }).setOrigin(0.5);

    const gameDesign = this.add.text(0, 200, 'HISTÓRIA & DIRETRIZES\nGame Design Document v1.0', {
      ...mono(14, COLORS_CSS.text),
      align: 'center',
    }).setOrigin(0.5);

    const engine = this.add.text(0, 280, 'TECNOLOGIA E ENGINE\nPhaser 4.0.0 & Vite', {
      ...mono(14, COLORS_CSS.text),
      align: 'center',
    }).setOrigin(0.5);

    const endMsg = this.add.text(0, 420, 'Obrigado por jogar!', display(24, this.cfg.color)).setOrigin(0.5);

    creditsGroup.add([title, sub, programmers, gameDesign, engine, endMsg]);

    // Subir os créditos
    this.tweens.add({
      targets: creditsGroup,
      y: 60,
      duration: 7000,
      ease: 'Linear',
      onComplete: () => {
        if (this.endingId === 'fantoche') {
          // Final C: apagão escuro e então o Plankton no trono
          this.revealFantocheThrone(() => this.addBackPrompt());
        } else {
          this.addBackPrompt();
        }
      },
    });
  }

  /** Final C: escurece tudo (apagão) e revela a imagem do Plankton no trono. */
  private revealFantocheThrone(after: () => void): void {
    const { width, height } = this.scale;
    const black = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setDepth(40);
    this.tweens.add({
      targets: black,
      alpha: 1,
      duration: 1000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.textures.exists('end-fantoche')) { after(); return; }
        const throne = this.add.image(width / 2, height / 2, 'end-fantoche').setDepth(41).setAlpha(0);
        this.tweens.add({ targets: throne, alpha: 1, duration: 1300, delay: 500, onComplete: after });
      },
    });
  }

  private addBackPrompt(): void {
    const { width, height } = this.scale;
    const backPrompt = this.add
      .text(width / 2, height - 70, '[ENTER] Voltar ao Menu Principal', mono(14, COLORS_CSS.gold))
      .setOrigin(0.5)
      .setDepth(45);

    this.tweens.add({ targets: backPrompt, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });

    const onFinalEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        window.removeEventListener('keydown', onFinalEnter);
        GameState.getInstance().reset();
        fadeToScene(this, 'MenuScene', undefined, 600);
      }
    };
    window.addEventListener('keydown', onFinalEnter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onFinalEnter);
    });
  }

  update(): void {
    if (this.isCreditsScroll) return;

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.advance();
    }
  }
}
