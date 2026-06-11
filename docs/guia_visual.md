# Fora do Cardume — Guia Visual & UI/UX

## v1.0 — Padrões obrigatórios para todas as fases

> Este guia consolida o design system implementado no overhaul visual (06/2026).
> **Toda fase nova (Fase 4, Boss Final, endings) deve seguir estes padrões.**
> Fonte única de verdade no código: `src/config/theme.ts`.

---

## 1. REGRA ZERO — theme.ts é a fonte única

Nenhuma cena ou entidade define cor, fonte ou efeito visual hardcoded. Tudo vem de `src/config/theme.ts`:

| Export | Uso |
|---|---|
| `COLORS` / `COLORS_CSS` | Paleta global (numérico p/ Graphics, string p/ Text) |
| `ATTACK_PALETTES` | Paleta de ataque por personagem (core/mid/halo) |
| `FONTS` + `display()` / `mono()` / `caption()` | Fábricas de TextStyle |
| `drawPanel()` | Painéis arredondados padrão (diálogo, HUD) |
| `makeGlowTexture()` / `makeGlowCapsule()` | Texturas de projétil com glow assado |
| `makeParticleDot()` | Dot compartilhado para emitters |
| `impactBurst()` | Explosão de impacto padrão (glow + fagulhas) |
| `tweenBarTo()` | Barras animadas (nunca `setDisplaySize` seco) |
| `fadeToScene()` / `fadeInScene()` | Transições de cena (nunca corte seco) |
| `ensureFonts()` | Espera das web fonts com timeout |

---

## 2. IDENTIDADE VISUAL — "Diário de mergulho retrô-arcade"

Estendida do menu (`MenuOverlay.ts`) para todo o jogo.

### Paleta global

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#0a1833` | Fundo de cena, loading |
| `panel` | `#0c2a52` | Painéis (diálogo, HUD) |
| `panelDark` | `#05142e` | Tracks de barras |
| `gold` | `#ffd400` | Acento primário: títulos, seleção, confirmação |
| `orange` | `#ff9a1f` | Acento secundário, par de gradiente do gold |
| `cyan` | `#4dd0e1` | Acento informativo: bordas, identidade do player |
| `text` | `#e8f4ff` | Texto corpo |
| `textDim` | `#7d93b3` | Hints, legendas (NUNCA usar marrom `#8D6E63` em UI) |
| `danger` | `#ff1744` | Game over, HP baixo |
| `success` | `#6fff8a` | HP do player, status OK |

### Tipografia

| Fonte | Papel | Exemplo |
|---|---|---|
| **Russo One** (`display()`) | Títulos, nomes de boss, vitória/derrota | "FENDA DO BIQUINI" |
| **JetBrains Mono** (`mono()` / `caption()`) | Corpo, diálogo, HUD, hints | `[ENTER] ▶ continuar` |

- Carregadas no `<head>` do `index.html` + `ensureFonts()` no BootScene (timeout 1500ms — CDN offline não trava o jogo).
- Labels de seção usam o padrão `◆ NOME DO LOCAL` em `caption()` com sombra.
- Teclas sempre em colchetes: `[Q]`, `[R]`, `[ENTER]`.

---

## 3. PALETAS DE ATAQUE — cada ação tem cor própria

Estrutura **core → mid → halo** (núcleo branco-quente → cor saturada → halo profundo). O contraste núcleo claro + halo escuro garante leitura sobre os cenários em foto.

| Ator | Core | Mid | Halo | Chave |
|---|---|---|---|---|
| Plankton laser (player) | `#e0f7ff` | `#4dd0e1` | `#0097a7` | `plankton` |
| Bob bolhas (prólogo) | `#ffffff` | `#81d4fa` | `#29b6f6` | `bob` |
| RoboPlankton | `#ffe0b2` | `#ff9a1f` | `#e65100` | `robo` |
| Patrick (pedras/onda) | `#ffe0d6` | `#ff8a65` | `#d84315` | `patrick` |
| Lula (notas) | `#f3e5f5` | `#b388ff` | `#7c4dff` | `lula` |
| Sandy (lasers) | `#ffebee` | `#ff5252` | `#d50000` | `sandy` |
| Sandy (granada gelo) | `#ffffff` | `#b2ebf2` | `#4dd0e1` | `ice` |
| Suprema (âncoras) | `#ccff90` | `#69f0ae` | `#1b5e20` | `suprema` |

### Proposta para fases futuras (adicionar em ATTACK_PALETTES ao implementar)

| Ator | Core | Mid | Halo | Racional |
|---|---|---|---|---|
| Bob boss (hambúrgueres) | `#fff8e1` | `#ffb300` | `#e65100` | Âmbar de lanchonete — distinto do gold da UI |
| Gary (gosma/rolagem) | `#f1f8e9` | `#aed581` | `#558b2f` | Verde-limo de lesma |
| Homem Sereia (raio) | `#e8f5e9` | `#66bb6a` | `#1b5e20` | Verde herói aposentado |
| Mexilhãozinho (bolhas) | `#e3f2fd` | `#64b5f6` | `#1565c0` | Azul-bolha guiada (mais escuro que o cyan do player) |
| Barris do Holandês | `#ccff90` | `#69f0ae` | `#1b5e20` | Mesma família espectral da Suprema |

**Regras:**
- O **cyan é do player** — nenhum inimigo pode atacar em cyan (o laser do Plankton já foi laranja e confundia com o RoboPlankton; nunca repetir).
- A cor da **barra de HP do boss = mid da paleta de ataque** dele (consistência leitura→ameaça).
- `projectileColor` no config do boss deve espelhar o mid da paleta.

---

## 4. RESTRIÇÃO TÉCNICA — Phaser 4 (sem preFX/postFX)

O projeto usa **Phaser 4.0.0**. `preFX`/`postFX` **não existem**. Padrões obrigatórios:

1. **Glow assado**: projéteis usam texturas geradas com camadas concêntricas (`makeGlowTexture`/`makeGlowCapsule`) + `BlendModes.ADD` no sprite. Custo zero por frame.
2. **Filters API** (`enableFilters()` + `filters.internal.addGlow(...)`) renderiza o objeto para textura **a cada frame**. Permitido SOMENTE em ≤4 objetos simultâneos e nunca em sprites de pool. Usos atuais: aura de fase final do boss (1 objeto) e âncoras da Suprema (máx. 4, curtas).
3. **Trails de projéteis em pool**: UM `ParticleEmitter` por cor com `frequency: -1`; chamar `emitter.emitParticleAt(p.x, p.y)` dentro do loop de cull já existente (que visita todo projétil ativo por frame). Nunca criar emitter por projétil, nunca `startFollow` em pool.
4. **Texturas geradas** sempre com guard `if (textures.exists(key)) return` — cenas reiniciam no retry e regerariam texturas.

---

## 5. JUICE DE COMBATE — checklist por ataque

Todo ataque novo deve ter os 4 estágios:

| Estágio | Padrão |
|---|---|
| **1. Telegraph** | Pulso de escala no boss + flash de aura colorida (elipse ADD atrás do corpo, alpha 0→0.4→0). Avisos de área: linha **tracejada** pulsante (lasers) ou anel no chão (quedas). Countdown visível quando houver timer (anel encolhendo âmbar→vermelho das estátuas). |
| **2. Disparo** | Muzzle flash localizado (glow ADD, scale 0.6→1.4, ~90-140ms) no ponto de origem. **NUNCA `camera.flash` em ataques repetidos** — 4 lasers em sequência piscando a tela inteira = bug reportado e removido. |
| **3. Voo** | Textura com glow assado + ADD + trail de partículas via emitter compartilhado. |
| **4. Impacto** | `impactBurst()` com a paleta do ataque + shake de câmera só em hits pesados (≤150ms, ≤0.008). |

Feedback de dano no boss (`BaseBoss.onHit`): alpha yoyo + punch de escala (1.05, 80ms) + jitter ±3px — já implementado na base, não duplicar.

---

## 6. PLATAFORMAS — acessibilidade e tema

### Física (obrigatório)

- **One-way sempre**: usar `BossPhaseScene.addOneWayPlatform(x, y, key)` — o jogador atravessa por baixo/pelos lados e pousa por cima. Nunca plataforma sólida que "bate a cabeça".
- **Matemática do pulo** (gravidade 800): altura máx = `v²/1600`.
  - Plankton (v=480): **144px** → degrau confortável ≤ **125px**
  - Bob (v=520): **169px** → degrau confortável ≤ **140px**
- Layout em **escada**: laterais baixas (~125px do chão) → central alta (degrau ~105-115px). Validar do chão E entre plataformas.
- Largura mínima 210px. Posicionar rota de fuga sobre ameaças de chão (ex.: plataforma central da Fase 2 contra estátuas).
- Chão das fases: topo em y=670 (cenas de boss) / y=680 (prólogo).

### Visual (tema por fase)

- **Topo destacado** em cor clara/neon (4-8px) — a superfície pisável precisa ler de longe sobre cenário em foto.
- Corpo temático + sombra inferior escura. Referências implementadas:

| Fase | Tema | Elementos |
|---|---|---|
| Prólogo | Deck do Siri Cascudo | Tábuas, frisos, pregos dourados, topo claro |
| 1 — Patrick | Rocha de coral | Corpo rosado arredondado, poros, topo de areia |
| 2 — Lula | Caixa de som de palco | Gabinete escuro, alto-falantes, LED, friso cyan |
| 3 — Sandy | Placa de laboratório | Metal, faixas de alerta, rebites, neon cyan |
| **4 — Ruínas (propor)** | Vigas caídas | Metal retorcido + fogo residual nas pontas, topo âmbar |
| **Final (propor)** | Rocha oceânica | Pedra escura + corais bioluminescentes, topo verde-água |

- Vigas dinâmicas da Fase 4 (GDD) também devem ser one-way ao pousarem.

---

## 7. HUD — padrões

- **Barra de boss**: 420×16 arredondada, nome em `display(13)` acima (`getBossName()`), fill na cor do boss + **damage-chip branco** que escorre com 250ms de delay (`tweenBarTo`).
- **HP do player**: pips com glow assado (`hud-hp-pip`), pop de partícula vermelha ao perder, pulso de perigo no último pip.
- **Barra de skill**: track arredondado, estado pronto = label `SUPREMA PRONTA — [Q]` em gold + burst único no rising edge (nunca burst contínuo).
- **Hints de controle**: `mono(11, textDim)` alpha 0.7, parte inferior.
- **Vitória**: `display(40)` gold com scale-in `Back.easeOut` + burst gold/orange + subtítulo `caption`.
- **Game over**: overlay tween 0→0.75 + shake 150ms + `[R] tentar novamente` em gold pulsante.
- Barras NUNCA mudam de largura instantaneamente — sempre `tweenBarTo`.

---

## 8. DIÁLOGO — padrões

- Painel via `drawPanel` com `accent: true` (barra gold à esquerda), tag `◆ TRANSMISSÃO` em `caption(10, cyan)` acima do nome.
- **Abertura**: container `y +24→0`, `alpha 0→1`, `scaleY 0.92→1`, 240ms `Back.easeOut`. **Fechamento**: reverso em 160ms antes de sair.
- Overlay a 0.7 (não 0.85 — a arena fica legível atrás).
- Typewriter a 22ms/char; prompt `[ENTER] ▶ continuar` pulsando alpha 0.35↔1 (nunca piscar até zero).
- Escolhas: caixas arredondadas, selecionada = stroke gold + label gold + tween `scale 1.03` / `y -2`.
- Confirmação: flash **gold** 0.35 alpha (nunca branco).

---

## 9. TRANSIÇÕES & LOADING

- Toda cena: `fadeInScene(this)` no topo do `create()`; toda saída: `fadeToScene(...)`. **Zero cortes secos.**
- Loading (BootScene): título com respiração + barra de progresso real tweened + % + nome do arquivo + bolhas cyan subindo. Mínimo 1200ms de exibição + espera de `ensureFonts()`.
- Bolhas ambiente (`makeParticleDot` tint cyan) também em telas estáticas (DemoEnd, endings futuros).

---

## 10. CHECKLIST PARA UMA FASE NOVA

```
[ ] getBossPalette() e getBossName() implementados (BossPhaseScene exige)
[ ] Paleta do boss adicionada em ATTACK_PALETTES (theme.ts)
[ ] getBossBarColor() = palette.mid
[ ] Projéteis: makeGlowTexture/Capsule + guard textures.exists
[ ] trailTint em ProjectileData para projéteis de cor diferente do padrão
[ ] Telegraph: pulso + aura ADD; avisos de área tracejados/anel
[ ] Muzzle flash localizado (sem camera.flash repetido)
[ ] impactBurst nos overlaps (projétil→player e laser→boss já vêm da base)
[ ] Plataformas: addOneWayPlatform + degraus ≤125px + textura temática
       com topo destacado
[ ] Label de local "◆ NOME" em caption() com sombra
[ ] Mensagem de fase final em display(24, corDoBoss) com scale-in
[ ] fadeInScene/fadeToScene nas entradas/saídas
[ ] Fontes via display()/mono()/caption() — nada de fontSize/color soltos
[ ] Restart (R) testado: texturas não duplicam, EventBus limpo no SHUTDOWN
[ ] FPS estável no pior caso de projéteis da fase
```

---

*Fora do Cardume • Guia Visual & UI/UX • v1.0 • 06/2026*
