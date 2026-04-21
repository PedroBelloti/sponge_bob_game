const Y = '#ffd400';
const O = '#ff9a1f';
const C = '#4dd0e1';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const RUSSO = '"Russo One", Impact, sans-serif';

let _overlay: HTMLElement | null = null;
let _keyHandler: ((e: KeyboardEvent) => void) | null = null;
let _sel = 0;
let _pressed = false;

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function mountMenuOverlay(onStart: () => void): void {
  injectCSS();

  const overlay = document.createElement('div');
  overlay.id = 'menu-overlay';
  _overlay = overlay;
  _sel = 0;
  _pressed = false;

  const bg = document.createElement('div');
  bg.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  buildOceanBG(bg);
  overlay.appendChild(bg);

  overlay.insertAdjacentHTML('beforeend',
    buildScanlinesHTML() +
    buildTopBarHTML() +
    buildContentHTML() +
    buildFooterHTML() +
    buildModalHTML() +
    buildFlashHTML()
  );

  _keyHandler = (e: KeyboardEvent) => handleKey(e, onStart);
  window.addEventListener('keydown', _keyHandler);

  overlay.querySelector('#btn-jogar')?.addEventListener('click', () => triggerStart(onStart));
  overlay.querySelector('#btn-jogar')?.addEventListener('mouseenter', () => { _sel = 0; syncButtons(); });
  overlay.querySelector('#btn-howto')?.addEventListener('click', showModal);
  overlay.querySelector('#btn-howto')?.addEventListener('mouseenter', () => { _sel = 1; syncButtons(); });
  overlay.querySelector('#howto-close')?.addEventListener('click', hideModal);
  overlay.querySelector('#howto-modal')?.addEventListener('click', (e) => {
    if (e.target === overlay.querySelector('#howto-modal')) hideModal();
  });

  document.body.appendChild(overlay);
  syncButtons();
}

export function unmountMenuOverlay(): void {
  if (_keyHandler) { window.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
  _overlay?.remove();
  _overlay = null;
}

// ── Keyboard & State ──────────────────────────────────────────────────────────

function handleKey(e: KeyboardEvent, onStart: () => void): void {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    _sel = (_sel + (e.key === 'ArrowDown' ? 1 : -1) + 2) % 2;
    syncButtons();
  } else if (e.key === 'Enter' && !_pressed) {
    _pressed = true;
    syncButtons();
    setTimeout(() => {
      _pressed = false;
      if (_sel === 0) triggerStart(onStart);
      else showModal();
    }, 220);
  }
}

function triggerStart(onStart: () => void): void {
  const flash = _overlay?.querySelector<HTMLElement>('#start-flash');
  if (flash) {
    flash.style.display = 'flex';
    flash.style.animation = 'none';
    flash.offsetHeight;
    flash.style.animation = 'flash-in .45s ease';
    setTimeout(() => { unmountMenuOverlay(); onStart(); }, 1400);
  } else {
    unmountMenuOverlay();
    onStart();
  }
}

function showModal(): void {
  const m = _overlay?.querySelector<HTMLElement>('#howto-modal');
  if (!m) return;
  m.style.display = 'flex';
  m.style.animation = 'none';
  m.offsetHeight;
  m.style.animation = 'modal-in .25s ease';
}

function hideModal(): void {
  const m = _overlay?.querySelector<HTMLElement>('#howto-modal');
  if (m) m.style.display = 'none';
}

function syncButtons(): void {
  if (!_overlay) return;
  const b0 = _overlay.querySelector<HTMLElement>('#btn-jogar');
  const b1 = _overlay.querySelector<HTMLElement>('#btn-howto');
  if (b0) applyBtnStyle(b0, _sel === 0, true,  _pressed && _sel === 0);
  if (b1) applyBtnStyle(b1, _sel === 1, false, _pressed && _sel === 1);
}

function applyBtnStyle(btn: HTMLElement, sel: boolean, primary: boolean, pressed: boolean): void {
  const accent = primary ? Y : C;
  const glowColor = primary ? 'rgba(255,154,31,0.4)' : 'rgba(77,208,225,0.4)';
  btn.style.border       = `1.5px solid ${sel ? accent : 'rgba(220,235,255,0.12)'}`;
  btn.style.background   = sel
    ? (primary
        ? `linear-gradient(90deg,rgba(255,212,0,0.18) 0%,rgba(255,154,31,0.08) 100%)`
        : `linear-gradient(90deg,rgba(77,208,225,0.15) 0%,rgba(77,208,225,0.04) 100%)`)
    : 'rgba(5,15,34,0.4)';
  btn.style.transform    = pressed ? 'scale(0.98) translateX(2px)' : (sel ? 'translateX(6px)' : 'translateX(0)');
  btn.style.boxShadow    = sel ? `0 0 0 0 ${accent},-3px 0 0 0 ${accent},0 0 24px ${glowColor}` : 'none';

  const lbl = btn.querySelector<HTMLElement>('.btn-label');
  const num = btn.querySelector<HTMLElement>('.btn-num');
  const arr = btn.querySelector<HTMLElement>('.btn-arrow');
  if (lbl) { lbl.style.color = sel ? (primary ? accent : '#fff') : 'rgba(220,235,255,0.75)'; lbl.style.textShadow = sel && primary ? '0 0 18px rgba(255,212,0,0.6)' : 'none'; }
  if (num) num.style.color = sel ? accent : 'rgba(220,235,255,0.4)';
  if (arr) arr.style.transform = sel ? 'translateX(3px)' : 'translateX(0)';
}

// ── Ocean Background ──────────────────────────────────────────────────────────

function buildOceanBG(container: HTMLElement): void {
  container.innerHTML = `
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 120% 80% at 50% -10%,#1a4a7a 0%,#0c2a52 30%,#05142e 70%,#020a1c 100%);"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(100,200,255,0.18) 0%,rgba(100,200,255,0) 60%);mix-blend-mode:screen;"></div>
    <svg viewBox="0 0 1000 600" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:screen;opacity:0.315;">
      <defs>
        <linearGradient id="cau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(120,220,255,0.5)"/>
          <stop offset="100%" stop-color="rgba(120,220,255,0)"/>
        </linearGradient>
      </defs>
      ${[0,1,2,3,4,5].map(i=>`<polygon points="${80+i*160},0 ${120+i*160},0 ${250+i*160},600 ${200+i*160},600" fill="url(#cau)" style="animation:oceanRay 7s ease-in-out infinite;animation-delay:${i*0.8}s;transform-origin:${100+i*160}px 0;"/>`).join('')}
    </svg>
    <svg viewBox="0 0 1000 600" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
      <defs>
        <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a1a3a" stop-opacity="0"/>
          <stop offset="60%" stop-color="#060f26" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#02060f" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <path d="M0,480 L80,420 L180,460 L280,400 L380,440 L480,380 L580,430 L680,390 L780,440 L880,410 L1000,450 L1000,600 L0,600 Z" fill="url(#mtn)" opacity="0.7"/>
      <path d="M0,560 L150,500 L300,540 L420,560 L480,520 L500,600 L520,520 L580,560 L700,530 L850,560 L1000,520 L1000,600 L0,600 Z" fill="#030a1c" opacity="0.9"/>
    </svg>
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice" style="position:absolute;inset:0;width:100%;height:100%;">
      <g fill="#010714" opacity="0.95" style="transform-origin:80px 600px;animation:oceanSwayL 6s ease-in-out infinite;">
        <path d="M40,600 C40,560 30,530 50,500 C55,480 45,460 60,440 C70,425 65,410 80,400 L85,420 C90,440 100,445 95,465 C92,485 105,495 100,515 C98,535 110,550 105,570 L105,600 Z"/>
        <path d="M20,600 L25,540 C30,520 20,500 35,485 L45,510 L50,600 Z"/>
      </g>
      <g fill="#010714" opacity="0.9" style="transform-origin:950px 600px;animation:oceanSwayR 7s ease-in-out infinite;">
        <path d="M900,600 C895,560 910,520 905,480 C900,440 915,400 910,360 L920,360 C925,400 940,440 935,480 C930,520 945,560 940,600 Z"/>
        <path d="M950,600 C945,570 955,540 950,510 L960,510 C965,540 975,570 970,600 Z"/>
        <path d="M870,600 C868,570 875,545 870,520 L880,520 C885,545 892,570 890,600 Z"/>
      </g>
      <g fill="#020814" opacity="1">
        <path d="M200,600 C200,580 230,560 280,565 C320,568 340,585 350,600 Z"/>
        <path d="M600,600 C600,585 640,570 700,575 C740,580 770,590 780,600 Z"/>
        <path d="M420,600 C420,590 440,580 480,582 C500,584 515,592 520,600 Z"/>
      </g>
      <g fill="#010714" opacity="0.9">
        <ellipse cx="730" cy="600" rx="8" ry="40"/>
        <ellipse cx="745" cy="600" rx="6" ry="30"/>
        <ellipse cx="760" cy="600" rx="7" ry="36"/>
        <ellipse cx="715" cy="600" rx="5" ry="24"/>
      </g>
    </svg>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 50%,rgba(0,0,0,0) 40%,rgba(0,0,0,0.5) 100%);pointer-events:none;"></div>
  `;

  // Fish — seed 42*41+7 = 1729
  const fr = mulberry32(1729);
  for (let i = 0; i < 5; i++) {
    const y = 20 + fr() * 60, delay = fr() * 20, dur = 25 + fr() * 20;
    const size = 12 + fr() * 18, flip = fr() > 0.5, opacity = 0.1 + fr() * 0.15;
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;top:${y}%;left:-10%;width:${size}px;height:${size*0.45}px;opacity:${opacity};animation:oceanFish ${dur}s linear infinite ${delay}s;transform:${flip?'scaleX(-1)':'none'};`;
    d.innerHTML = `<svg viewBox="0 0 40 18" width="100%" height="100%"><path d="M0,9 C5,2 15,2 25,6 L32,4 L30,9 L32,14 L25,12 C15,16 5,16 0,9 Z" fill="#000"/></svg>`;
    container.appendChild(d);
  }

  // Particles — seed 42*17+3 = 717
  const pr = mulberry32(717);
  for (let i = 0; i < 40; i++) {
    const x = pr()*100, y = pr()*100, size = 1+pr()*2.5, delay = pr()*8, dur = 4+pr()*6, opacity = 0.1+pr()*0.4;
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-radius:50%;background:rgba(180,220,255,0.6);opacity:${opacity};animation:oceanParticle ${dur}s ease-in-out infinite ${delay}s;box-shadow:0 0 4px rgba(180,220,255,0.5);`;
    container.appendChild(d);
  }

  // Bubbles — seed 42*9973 = 419066
  const br = mulberry32(419066);
  for (let i = 0; i < 28; i++) {
    const left = br()*100, size = 3+br()*10, delay = br()*14, dur = 9+br()*10, drift = (br()-0.5)*40, opacity = 0.15+br()*0.35;
    const d = document.createElement('div');
    d.setAttribute('style', `position:absolute;bottom:-40px;left:${left}%;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,0.7) 0%,rgba(150,220,255,0.25) 40%,rgba(150,220,255,0) 70%);border:1px solid rgba(255,255,255,0.25);opacity:${opacity};animation:oceanBubble ${dur}s linear infinite ${delay}s;--drift:${drift}px;`);
    container.appendChild(d);
  }
}

// ── HTML Builders ─────────────────────────────────────────────────────────────

function buildScanlinesHTML(): string {
  return `<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0 1px,transparent 1px 3px);pointer-events:none;z-index:6;"></div>`;
}

function buildTopBarHTML(): string {
  return `
  <div style="position:absolute;top:0;left:0;right:0;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:14px 32px;border-bottom:1px solid rgba(77,208,225,0.15);background:linear-gradient(180deg,rgba(0,0,0,0.4) 0%,transparent 100%);">
    <div style="display:flex;align-items:center;gap:14px;font-family:${MONO};font-size:11px;letter-spacing:2px;color:rgba(220,235,255,0.7);">
      <div style="width:22px;height:22px;border:1.5px solid ${Y};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${Y};">FB</div>
      <span style="text-transform:uppercase;">Sistema de Mergulho</span>
      <span style="opacity:0.4;">/</span>
      <span style="color:${C};">v0.1.0</span>
      <span style="opacity:0.3;margin:0 4px;">│</span>
      <span style="letter-spacing:1.5px;">◉ LAT <span style="color:#e8f4ff;">−15.247</span></span>
      <span style="letter-spacing:1.5px;">LON <span style="color:#e8f4ff;">−145.802</span></span>
      <span style="color:${Y};letter-spacing:1.5px;">◆ EXPEDIÇÃO ATIVA</span>
    </div>
    <div style="display:flex;gap:18px;font-family:${MONO};font-size:11px;letter-spacing:2px;color:rgba(220,235,255,0.55);">
      <span>◉ O₂ TANQUE <span style="color:#e8f4ff;">98%</span></span>
      <span>▲ PROF <span style="color:#e8f4ff;">2,140 m</span></span>
      <span>BUILD <span style="color:#e8f4ff;">2026.04</span></span>
      <span style="color:#6fff8a;display:flex;align-items:center;gap:6px;">
        <span style="width:6px;height:6px;border-radius:50%;background:#6fff8a;box-shadow:0 0 6px #6fff8a;display:inline-block;"></span>
        SINAL ESTÁVEL
      </span>
    </div>
  </div>`;
}

function buildContentHTML(): string {
  return `
  <div style="position:absolute;inset:0;padding-top:64px;padding-bottom:48px;display:grid;grid-template-columns:1.1fr 1fr;align-items:center;z-index:9;">
    <div style="padding:0 56px 0 64px;">
      <div style="font-family:${MONO};font-size:11px;letter-spacing:4px;color:${C};text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:10px;">
        <span style="width:8px;height:8px;background:${C};border-radius:50%;box-shadow:0 0 8px ${C};display:inline-block;"></span>
        Dive Log · Entrada 001
      </div>
      <h1 style="margin:0;font-size:clamp(56px,8vw,120px);font-weight:900;letter-spacing:-3px;line-height:0.88;background:linear-gradient(180deg,${Y} 0%,${O} 80%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:title-breathe 4s ease-in-out infinite;">
        FENDA<br>DO<br>BIQUINI
      </h1>
      <div style="margin-top:22px;padding-left:16px;border-left:2px solid ${C};font-family:${MONO};font-size:13px;line-height:1.6;color:rgba(220,235,255,0.75);">
        <div style="color:${C};font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">— FORA DO CARDUME —</div>
        <div style="font-style:italic;">"O real valor da fórmula secreta<br>não está nela, e sim na jornada até ela."</div>
      </div>
      <div style="margin-top:42px;display:flex;flex-direction:column;gap:10px;max-width:360px;">
        <button id="btn-jogar" style="text-align:left;padding:14px 18px 14px 22px;font-family:${RUSSO};color:#fff;cursor:pointer;border-radius:2px;transition:all .15s ease;display:flex;align-items:center;justify-content:space-between;gap:16px;backdrop-filter:blur(2px);">
          <div style="display:flex;align-items:center;gap:14px;">
            <span class="btn-num" style="font-family:${MONO};font-size:11px;letter-spacing:1.5px;font-weight:700;transition:color .15s;">01</span>
            <span class="btn-label" style="font-size:20px;font-weight:800;letter-spacing:3px;transition:color .15s,text-shadow .15s;">JOGAR</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-family:${MONO};font-size:11px;letter-spacing:1.5px;color:rgba(220,235,255,0.35);text-transform:lowercase;">
            <span>Iniciar mergulho</span>
            <span class="btn-arrow" style="font-size:14px;transition:transform .2s;">▶</span>
          </div>
        </button>
        <button id="btn-howto" style="text-align:left;padding:14px 18px 14px 22px;font-family:${RUSSO};color:#fff;cursor:pointer;border-radius:2px;transition:all .15s ease;display:flex;align-items:center;justify-content:space-between;gap:16px;backdrop-filter:blur(2px);">
          <div style="display:flex;align-items:center;gap:14px;">
            <span class="btn-num" style="font-family:${MONO};font-size:11px;letter-spacing:1.5px;font-weight:700;transition:color .15s;">02</span>
            <span class="btn-label" style="font-size:20px;font-weight:800;letter-spacing:3px;transition:color .15s,text-shadow .15s;">COMO JOGAR</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-family:${MONO};font-size:11px;letter-spacing:1.5px;color:rgba(220,235,255,0.35);text-transform:lowercase;">
            <span>Controles e sinais</span>
            <span class="btn-arrow" style="font-size:14px;transition:transform .2s;">▶</span>
          </div>
        </button>
      </div>
      <div style="margin-top:24px;display:flex;align-items:center;gap:8px;font-family:${MONO};font-size:10px;letter-spacing:2.5px;color:rgba(220,235,255,0.45);text-transform:uppercase;">
        ${kbd('↑')}${kbd('↓')}<span>navegar</span>
        <span style="margin:0 6px;opacity:0.4;">·</span>
        ${kbd('ENTER')}<span>selecionar</span>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 56px;">
      ${buildPortholeHTML()}
    </div>
  </div>`;
}

function kbd(k: string): string {
  return `<kbd style="padding:2px 7px;border:1px solid rgba(220,235,255,0.3);border-radius:2px;font-family:${MONO};font-size:10px;font-weight:700;color:#e8f4ff;background:rgba(255,255,255,0.04);box-shadow:inset 0 -1px 0 rgba(0,0,0,0.3);">${k}</kbd>`;
}

function buildPortholeHTML(): string {
  const S = 420, cx = S / 2, cy = S / 2;
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const r1 = S / 2 - 24, r2 = S / 2 - (i % 6 === 0 ? 32 : 28);
    const big = i % 6 === 0;
    return `<line x1="${cx+Math.cos(a)*r1}" y1="${cy+Math.sin(a)*r1}" x2="${cx+Math.cos(a)*r2}" y2="${cy+Math.sin(a)*r2}" stroke="${big ? Y : 'rgba(220,235,255,0.3)'}" stroke-width="${big ? '1.5' : '1'}"/>`;
  }).join('');
  const screws = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8, r = S / 2 - 8;
    const sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r;
    return `<g transform="translate(${sx},${sy})"><circle r="5" fill="#1a2238" stroke="rgba(220,235,255,0.3)" stroke-width="1"/><line x1="-3" y1="0" x2="3" y2="0" stroke="rgba(220,235,255,0.5)" stroke-width="1"/></g>`;
  }).join('');
  return `
    <div style="position:relative;width:${S}px;height:${S}px;">
      <svg width="${S}" height="${S}" style="position:absolute;inset:0;">
        <defs>
          <radialGradient id="glass-g" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#1a4a7a"/>
            <stop offset="70%" stop-color="#05142e"/>
            <stop offset="100%" stop-color="#020818"/>
          </radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${S/2-2}" fill="none" stroke="rgba(220,235,255,0.15)" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="${S/2-14}" fill="none" stroke="${Y}" stroke-width="1.5" stroke-dasharray="2 6" opacity="0.55"/>
        ${ticks}
        <circle cx="${cx}" cy="${cy}" r="${S/2-44}" fill="url(#glass-g)"/>
        ${screws}
      </svg>
      <div style="position:absolute;top:44px;left:44px;right:44px;bottom:44px;border-radius:50%;overflow:hidden;">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,#1d4e80 0%,#061330 70%,#02081a 100%);">
          <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;">
            <g opacity="0.5" style="animation:oceanRay 7s ease-in-out infinite;">
              <polygon points="60,0 80,0 110,200 90,200" fill="rgba(120,220,255,0.25)"/>
              <polygon points="110,0 130,0 150,200 130,200" fill="rgba(120,220,255,0.15)"/>
            </g>
            <path d="M0,150 L30,130 L60,140 L90,120 L110,100 L130,120 L160,130 L200,110 L200,200 L0,200 Z" fill="#050d24" opacity="0.8"/>
            <path d="M0,180 L80,160 L95,130 L100,200 L105,130 L120,160 L200,180 L200,200 L0,200 Z" fill="#010817"/>
            <circle cx="40" cy="80" r="1.5" fill="#fff" opacity="0.5" style="animation:fish-dot 12s linear infinite;"/>
            <circle cx="30" cy="100" r="1" fill="#fff" opacity="0.4" style="animation:fish-dot 15s linear infinite;animation-delay:3s;"/>
            <circle cx="50" cy="70" r="1" fill="#fff" opacity="0.4" style="animation:fish-dot 10s linear infinite;animation-delay:6s;"/>
          </svg>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;">
          <line x1="50" y1="0" x2="50" y2="100" stroke="${Y}" stroke-width="0.2" opacity="0.35"/>
          <line x1="0" y1="50" x2="100" y2="50" stroke="${Y}" stroke-width="0.2" opacity="0.35"/>
          <circle cx="50" cy="50" r="18" fill="none" stroke="${Y}" stroke-width="0.2" opacity="0.4"/>
          <circle cx="50" cy="50" r="35" fill="none" stroke="${Y}" stroke-width="0.2" opacity="0.25"/>
        </svg>
        <div style="position:absolute;top:50%;left:50%;width:10px;height:10px;border:1.5px solid ${Y};border-radius:50%;box-shadow:0 0 10px ${Y};animation:target-pulse 1.6s ease-in-out infinite;transform:translate(-50%,-50%);"></div>
      </div>
      <div style="position:absolute;bottom:-36px;left:0;right:0;text-align:center;font-family:${MONO};font-size:10px;letter-spacing:3px;color:rgba(220,235,255,0.55);text-transform:uppercase;">Vista externa · Setor 7</div>
    </div>`;
}

function buildFooterHTML(): string {
  return `
  <div style="position:absolute;bottom:0;left:0;right:0;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:12px 32px;border-top:1px solid rgba(77,208,225,0.12);font-family:${MONO};font-size:10px;letter-spacing:2.5px;color:rgba(180,220,255,0.45);text-transform:uppercase;">
    <span>● Coordenadas protegidas por criptografia</span>
    <span>Expedição independente · 2026</span>
  </div>`;
}

function buildModalHTML(): string {
  const rows: [string, string][] = [
    ['Mover', 'A · D'], ['Pular', 'ESPAÇO'], ['Agachar', 'S'],
    ['Dash', 'SHIFT'], ['Atirar', 'MOUSE 1'], ['Habilidade especial', 'CTRL + M1 ou M2'],
  ];
  return `
  <div id="howto-modal" style="position:fixed;inset:0;background:rgba(2,6,16,0.85);backdrop-filter:blur(10px);z-index:10000;display:none;align-items:center;justify-content:center;">
    <div style="background:linear-gradient(180deg,#0c2a52 0%,#05142e 100%);border:1.5px solid ${Y};box-shadow:0 0 0 1px rgba(255,212,0,0.2),0 0 60px rgba(255,212,0,0.2),0 20px 80px rgba(0,0,0,0.6);border-radius:6px;padding:36px 44px;max-width:520px;width:90%;color:#e8f4ff;font-family:${MONO};">
      <div style="font-size:11px;letter-spacing:3px;color:${C};text-transform:uppercase;margin-bottom:6px;">◆ MANUAL DE MERGULHO</div>
      <h2 style="margin:0 0 22px;font-family:${RUSSO};font-size:28px;letter-spacing:2px;color:${Y};text-shadow:0 0 20px rgba(255,212,0,0.4);">COMO JOGAR</h2>
      <ul style="list-style:none;padding:0;margin:0;font-size:14px;line-height:1.9;">
        ${rows.map(([a, k], i) => `<li style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;${i < rows.length - 1 ? 'border-bottom:1px dashed rgba(77,208,225,0.2);' : ''}"><span>${a}</span><kbd style="padding:3px 10px;border:1px solid rgba(220,235,255,0.3);border-radius:3px;font-family:${MONO};font-size:11px;font-weight:700;background:rgba(255,255,255,0.05);color:#fff;box-shadow:inset 0 -1px 0 rgba(0,0,0,0.3);">${k}</kbd></li>`).join('')}
      </ul>
      <button id="howto-close" style="all:unset;box-sizing:border-box;margin-top:24px;padding:10px 24px;background:${Y};color:#0a1833;border-radius:3px;font-family:${RUSSO};font-size:13px;letter-spacing:2px;cursor:pointer;font-weight:800;display:inline-block;">ENTENDI</button>
    </div>
  </div>`;
}

function buildFlashHTML(): string {
  return `<div id="start-flash" style="position:fixed;inset:0;z-index:10001;background:${Y};display:none;align-items:center;justify-content:center;color:#0a1833;font-family:${RUSSO};font-size:44px;letter-spacing:6px;font-weight:900;">INICIANDO MERGULHO...</div>`;
}

// ── CSS Injection ─────────────────────────────────────────────────────────────

function injectCSS(): void {
  if (document.getElementById('menu-overlay-css')) return;
  const s = document.createElement('style');
  s.id = 'menu-overlay-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=JetBrains+Mono:wght@400;500;700&display=swap');
    @keyframes oceanBubble{0%{transform:translate(0,0) scale(0.6);opacity:0}10%{opacity:0.4}90%{opacity:0.4}100%{transform:translate(var(--drift,0px),-110vh) scale(1);opacity:0}}
    @keyframes oceanParticle{0%,100%{transform:translate(0,0)}50%{transform:translate(6px,-10px)}}
    @keyframes oceanRay{0%,100%{opacity:.35;transform:skewX(-2deg)}50%{opacity:.6;transform:skewX(2deg)}}
    @keyframes oceanFish{0%{transform:translateX(0) translateY(0)}50%{transform:translateX(60vw) translateY(-8px)}100%{transform:translateX(120vw) translateY(0)}}
    @keyframes oceanSwayL{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}
    @keyframes oceanSwayR{0%,100%{transform:rotate(1.5deg)}50%{transform:rotate(-1.5deg)}}
    @keyframes target-pulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1}50%{transform:translate(-50%,-50%) scale(1.8);opacity:.5}}
    @keyframes fish-dot{0%{transform:translateX(0)}100%{transform:translateX(180px)}}
    @keyframes title-breathe{0%,100%{filter:drop-shadow(0 0 24px rgba(255,154,31,.35))}50%{filter:drop-shadow(0 0 40px rgba(255,154,31,.6))}}
    @keyframes modal-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes flash-in{0%{opacity:0}40%{opacity:1}100%{opacity:1}}
    #menu-overlay{position:fixed;inset:0;z-index:10000;overflow:hidden;font-family:"Russo One",Impact,sans-serif;color:#e8f4ff;background:#0a1833;}
    #menu-overlay button{all:unset;box-sizing:border-box;}
  `;
  document.head.appendChild(s);
}
