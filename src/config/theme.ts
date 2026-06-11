import * as Phaser from 'phaser';

/**
 * Design tokens + helpers visuais do jogo.
 *
 * Estende a identidade do MenuOverlay (navy/gold/cyan/orange, "diário de
 * mergulho retrô-arcade") para dentro do canvas. Phaser 4 não tem
 * preFX/postFX — o glow dos projéteis é "assado" nas texturas geradas
 * (círculos concêntricos com núcleo branco-quente) + BlendModes.ADD.
 */

// ── Cores ───────────────────────────────────────────────────────

export const COLORS = {
  bg:        0x0a1833,
  panel:     0x0c2a52,
  panelDark: 0x05142e,
  gold:      0xffd400,
  orange:    0xff9a1f,
  cyan:      0x4dd0e1,
  danger:    0xff1744,
  success:   0x6fff8a,
  skill:     0x39ff14,
} as const;

export const COLORS_CSS = {
  gold:    '#ffd400',
  orange:  '#ff9a1f',
  cyan:    '#4dd0e1',
  text:    '#e8f4ff',
  textDim: '#7d93b3',
  danger:  '#ff1744',
  success: '#6fff8a',
  skill:   '#39ff14',
} as const;

// ── Paletas de ataque (núcleo branco-quente → meio → halo) ──────

export interface AttackPalette {
  core: number;
  mid: number;
  halo: number;
}

export const ATTACK_PALETTES = {
  /** Laser do Plankton jogável — cyan = identidade do player. */
  plankton: { core: 0xe0f7ff, mid: 0x4dd0e1, halo: 0x0097a7 },
  /** Bolhas do Bob no prólogo. */
  bob:      { core: 0xffffff, mid: 0x81d4fa, halo: 0x29b6f6 },
  /** RoboPlankton — laranja vilão-tech. */
  robo:     { core: 0xffe0b2, mid: 0xff9a1f, halo: 0xe65100 },
  /** Pedras/shockwave do Patrick — coral de estrela-do-mar. */
  patrick:  { core: 0xffe0d6, mid: 0xff8a65, halo: 0xd84315 },
  /** Notas de clarinete do Lula — violeta elétrico. */
  lula:     { core: 0xf3e5f5, mid: 0xb388ff, halo: 0x7c4dff },
  /** Lasers da Sandy — vermelho de laboratório. */
  sandy:    { core: 0xffebee, mid: 0xff5252, halo: 0xd50000 },
  /** Granadas de gelo da Sandy — branco gélido. */
  ice:      { core: 0xffffff, mid: 0xb2ebf2, halo: 0x4dd0e1 },
  /** Âncoras da Suprema — verde espectral do Holandês. */
  suprema:  { core: 0xccff90, mid: 0x69f0ae, halo: 0x1b5e20 },
  /** Bob boss (hambúrgueres) — âmbar de lanchonete. */
  bobBoss:  { core: 0xfff8e1, mid: 0xffb300, halo: 0xe65100 },
  /** Gary (gosma/rolagem) — verde-limo de lesma. */
  gary:     { core: 0xf1f8e9, mid: 0xaed581, halo: 0x558b2f },
  /** Homem Sereia (raio) — verde herói aposentado. */
  mermaidMan: { core: 0xe8f5e9, mid: 0x66bb6a, halo: 0x1b5e20 },
  /** Mexilhãozinho (bolhas) — azul-bolha guiada. */
  barnacleBoy: { core: 0xe3f2fd, mid: 0x64b5f6, halo: 0x1565c0 },
} as const satisfies Record<string, AttackPalette>;

// ── Fontes ──────────────────────────────────────────────────────

export const FONTS = {
  RUSSO: '"Russo One", Impact, sans-serif',
  MONO:  '"JetBrains Mono", ui-monospace, monospace',
} as const;

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

/** Título/destaque — Russo One. */
export function display(size: number, color: string = COLORS_CSS.gold): TextStyle {
  return { fontFamily: FONTS.RUSSO, fontSize: `${size}px`, color };
}

/** Corpo/UI — JetBrains Mono. */
export function mono(size: number, color: string = COLORS_CSS.text): TextStyle {
  return { fontFamily: FONTS.MONO, fontSize: `${size}px`, color };
}

/** Legenda apagada com tracking largo (padrão do menu). */
export function caption(size: number = 11, color: string = COLORS_CSS.textDim): TextStyle {
  return { fontFamily: FONTS.MONO, fontSize: `${size}px`, color, letterSpacing: 2 };
}

/**
 * Garante as web fonts antes de renderizar texto no canvas.
 * Race com timeout: CDN offline nunca trava o jogo.
 */
export function ensureFonts(): Promise<void> {
  const load = Promise.all([
    document.fonts.load('16px "Russo One"'),
    document.fonts.load('16px "JetBrains Mono"'),
    document.fonts.load('bold 16px "JetBrains Mono"'),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1500));
  return Promise.race([load, timeout]).catch(() => undefined);
}

// ── Painéis ─────────────────────────────────────────────────────

export interface PanelOptions {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  radius?: number;
  /** Barra de acento gold de 4px na borda esquerda. */
  accent?: boolean;
}

/**
 * Painel arredondado no estilo do menu. (x, y) é o canto superior esquerdo.
 * Retorna o Graphics para o chamador posicionar/animar (ex.: num Container).
 */
export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {},
): Phaser.GameObjects.Graphics {
  const {
    fillColor = COLORS.panel,
    fillAlpha = 0.95,
    strokeColor = COLORS.cyan,
    strokeAlpha = 0.5,
    radius = 10,
    accent = false,
  } = opts;

  const g = scene.add.graphics();
  g.fillStyle(fillColor, fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(1.5, strokeColor, strokeAlpha);
  g.strokeRoundedRect(x, y, w, h, radius);
  if (accent) {
    g.fillStyle(COLORS.gold, 0.9);
    g.fillRoundedRect(x, y + radius, 4, h - radius * 2, 2);
  }
  return g;
}

// ── Texturas com glow assado ────────────────────────────────────

/**
 * Círculo com glow assado: halo → meio → núcleo branco-quente.
 * `radius` é o raio total (halo incluso). Usar com BlendModes.ADD.
 */
export function makeGlowTexture(
  scene: Phaser.Scene,
  key: string,
  palette: AttackPalette,
  radius: number,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  const c = radius;
  g.fillStyle(palette.halo, 0.22);
  g.fillCircle(c, c, radius);
  g.fillStyle(palette.mid, 0.6);
  g.fillCircle(c, c, radius * 0.72);
  g.fillStyle(palette.mid, 0.9);
  g.fillCircle(c, c, radius * 0.55);
  g.fillStyle(palette.core, 1);
  g.fillCircle(c, c, radius * 0.34);
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
}

/**
 * Cápsula com glow assado (lasers). `w`/`h` são o tamanho total da textura,
 * já com a margem do halo embutida.
 */
export function makeGlowCapsule(
  scene: Phaser.Scene,
  key: string,
  palette: AttackPalette,
  w: number,
  h: number,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  const r = (layerH: number) => Math.min(layerH / 2, w / 2);

  const haloH = h;
  const midH = h * 0.62;
  const coreH = Math.max(2, h * 0.3);

  g.fillStyle(palette.halo, 0.25);
  g.fillRoundedRect(0, 0, w, haloH, r(haloH));
  g.fillStyle(palette.mid, 0.85);
  g.fillRoundedRect(w * 0.04, (h - midH) / 2, w * 0.92, midH, r(midH));
  g.fillStyle(palette.core, 1);
  g.fillRoundedRect(w * 0.1, (h - coreH) / 2, w * 0.8, coreH, r(coreH));
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Dot suave para emitters de partícula (tintável). */
export function makeParticleDot(scene: Phaser.Scene, key: string = 'fx-dot'): string {
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 2);
    g.generateTexture(key, 8, 8);
    g.destroy();
  }
  return key;
}

// ── Barras animadas ─────────────────────────────────────────────

/**
 * Anima a largura de uma barra até `percent` (0..1) de `fullWidth`.
 * Substitui o setDisplaySize/width instantâneo.
 */
export function tweenBarTo(
  scene: Phaser.Scene,
  bar: Phaser.GameObjects.Rectangle,
  fullWidth: number,
  percent: number,
  durationMs: number = 250,
  delayMs: number = 0,
): void {
  scene.tweens.add({
    targets: bar,
    displayWidth: Math.max(0, fullWidth * Phaser.Math.Clamp(percent, 0, 1)),
    duration: durationMs,
    delay: delayMs,
    ease: 'Cubic.easeOut',
  });
}

// ── Transições de cena ──────────────────────────────────────────

/** Fade-out da câmera e troca de cena — corte seco nunca mais. */
export function fadeToScene(
  scene: Phaser.Scene,
  key: string,
  data?: object,
  durationMs: number = 350,
): void {
  const cam = scene.cameras.main;
  cam.fadeOut(durationMs, 0, 0, 0);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

/** Fade-in padrão no topo do create() de cada cena. */
export function fadeInScene(scene: Phaser.Scene, durationMs: number = 350): void {
  scene.cameras.main.fadeIn(durationMs, 0, 0, 0);
}

// ── Efeitos one-shot ────────────────────────────────────────────

/**
 * Burst de impacto: glow expandindo + partículas radiais.
 * Usa textura de dot compartilhada; barato o bastante para todo hit.
 */
export function impactBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  palette: AttackPalette,
  opts: { particles?: number; scale?: number; depth?: number } = {},
): void {
  const { particles = 7, scale = 1, depth = 9 } = opts;
  const dot = makeParticleDot(scene);

  // Glow one-shot expandindo
  const glowKey = `fx-impact-${palette.mid.toString(16)}`;
  makeGlowTexture(scene, glowKey, palette, 18);
  const flash = scene.add
    .image(x, y, glowKey)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(depth)
    .setScale(scale);
  scene.tweens.add({
    targets: flash,
    scale: scale * 1.9,
    alpha: 0,
    duration: 140,
    ease: 'Quad.easeOut',
    onComplete: () => flash.destroy(),
  });

  // Fagulhas radiais
  const emitter = scene.add
    .particles(x, y, dot, {
      speed: { min: 60, max: 180 },
      lifespan: { min: 160, max: 320 },
      scale: { start: 0.9 * scale, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: palette.mid,
      emitting: false,
    })
    .setDepth(depth);
  emitter.explode(particles, 0, 0);
  scene.time.delayedCall(420, () => emitter.destroy());
}
