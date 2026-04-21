# Fora do Cardume — Documentação Técnica de Arquitetura

## v1.0 — Referência para implementação

---

## 1. VISÃO GERAL DO PROJETO

| Campo | Detalhe |
|---|---|
| **Nome** | Fora do Cardume |
| **Gênero** | Plataforma 2D Boss Rush |
| **Referência de gameplay** | Cuphead |
| **Universo** | Bob Esponja — Fenda do Biquini |
| **Plataforma** | Web (Browser) |
| **Linguagem** | TypeScript 5.x — strict mode |
| **Engine** | Phaser 5.x |
| **Bundler** | Vite |

---

## 2. STACK COMPLETA

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Engine de jogo | Phaser 5 | Loop de jogo, física arcade, spritesheets, câmera, grupos de objetos nativos |
| Linguagem | TypeScript strict | Tipagem forte em sistemas de jogo reduz bugs de estado e padrão de ataque |
| Bundler | Vite | Hot reload instantâneo, build otimizado, suporte nativo a TypeScript |
| LLM / Karen | Anthropic API (claude-sonnet-4-20250514) | Personalidade dinâmica da Karen baseada no histórico de escolhas do jogador |
| Persistência | localStorage + JSON estruturado | Sem backend, roda 100% no browser, suficiente para save de progresso e escolhas |
| Cutscenes | HTML5 Video (MP4) | Phaser delega para elemento de vídeo nativo do browser — sem overhead de decode |
| Assets | PNG spritesheets + MP4 | Spritesheets para personagens animados, MP4 para cutscenes, PNG estático para cenários |

---

## 3. PRINCÍPIOS DE ARQUITETURA

Estes princípios devem guiar toda decisão de implementação. Quando houver dúvida sobre onde colocar código, consulte aqui.

### 3.1 GameState é a única fonte da verdade

Nenhuma Scene, Entity ou System armazena estado do jogo localmente em propriedades de instância. Todo estado relevante ao progresso, escolhas morais, fase atual e skill desbloqueada vive exclusivamente em `GameState`. O acesso é sempre via singleton.

Isso garante que o SaveManager consiga serializar o estado completo em qualquer momento sem precisar coletar dados de múltiplos objetos.

### 3.2 Scenes orquestram — Systems e Entities executam

Uma Scene é responsável por inicializar os sistemas da fase, registrar listeners de eventos e fazer transições para outras Scenes. Ela não contém lógica de colisão, cálculo de dano, padrões de ataque ou chamadas de API.

Toda lógica de execução vive em Systems (ChoiceSystem, SkillSystem, HUDSystem, ScenarioSystem) ou em Entities (Plankton, BaseBoss e suas subclasses).

### 3.3 Comunicação entre sistemas via EventBus

Systems, Scenes e Entities que precisam se comunicar usam exclusivamente o EventBus central. Nunca passar referências diretas entre sistemas não relacionados. Isso desacopla os sistemas e permite que cada um evolua independentemente.

### 3.4 Entities são objetos puros de jogo

Entities não fazem chamadas de API, não leem localStorage e não acessam o HUD diretamente. Elas recebem configuração via construtor, executam comportamento de jogo e emitem eventos quando algo relevante acontece (dano recebido, fase final ativada, morte).

### 3.5 Performance via Object Pooling

Projéteis, partículas e efeitos visuais temporários usam object pooling — nunca instanciar e destruir objetos repetidamente no loop de jogo. O Phaser tem suporte nativo a grupos estáticos para isso.

### 3.6 Configuração externalizada

Valores numéricos de gameplay (velocidades, danos, HP, timings, thresholds de fase final) vivem exclusivamente em `src/config/constants.ts`. Nunca hardcodar esses valores dentro de Entities ou Systems.

---

## 4. ESTRUTURA DE PASTAS

```
fora-do-cardume/
├── public/
│   ├── assets/
│   │   ├── sprites/             # spritesheets PNG dos personagens
│   │   │   ├── plankton.png
│   │   │   ├── patrick.png
│   │   │   ├── lula.png
│   │   │   ├── sandy.png
│   │   │   ├── bob.png
│   │   │   ├── gary.png
│   │   │   ├── homem-sereia.png
│   │   │   └── mexilhaozinho.png
│   │   ├── backgrounds/         # imagens de fundo estáticas por fase
│   │   │   ├── siri-cascudo.png
│   │   │   ├── pedra-patrick.png
│   │   │   ├── casa-lula.png
│   │   │   ├── cupula-sandy.png
│   │   │   ├── ruinas.png
│   │   │   └── arena-final.png
│   │   ├── ui/                  # HUD, ícones, botões, caixas de diálogo
│   │   ├── audio/               # músicas por fase e efeitos sonoros
│   │   └── video/               # cutscenes em MP4
│   │       ├── prologo.mp4
│   │       ├── virada.mp4
│   │       ├── ending-a.mp4
│   │       ├── ending-b.mp4
│   │       └── ending-c.mp4
│   └── index.html
│
├── src/
│   ├── main.ts                  # entrada do Vite — instancia o Phaser com PhaserConfig
│   │
│   ├── config/
│   │   ├── phaser.config.ts     # configuração global do Phaser (resolução, física, scenes)
│   │   └── constants.ts         # todos os valores numéricos de gameplay
│   │
│   ├── core/
│   │   └── EventBus.ts          # pub/sub central — única forma de comunicação entre sistemas
│   │
│   ├── state/
│   │   ├── GameState.ts         # singleton — fonte da verdade de todo o jogo
│   │   └── SaveManager.ts       # serializa e deserializa GameState no localStorage
│   │
│   ├── scenes/
│   │   ├── BootScene.ts         # carrega todos os assets antes de qualquer outra Scene
│   │   ├── MenuScene.ts         # tela inicial com opções novo jogo e continuar
│   │   ├── CutsceneScene.ts     # toca vídeos MP4 e transiciona para a próxima Scene
│   │   ├── DialogScene.ts       # renderiza diálogos, captura escolha e grava no GameState
│   │   ├── phases/
│   │   │   ├── Phase1Scene.ts   # Patrick Estrela
│   │   │   ├── Phase2Scene.ts   # Lula Molusco
│   │   │   ├── Phase3Scene.ts   # Sandy Bochechas
│   │   │   ├── Phase4Scene.ts   # Bob Esponja + Gary
│   │   │   └── FinalScene.ts    # Homem Sereia e Mexilhãozinho
│   │   └── endings/
│   │       ├── EndingAScene.ts  # Final Redenção
│   │       ├── EndingBScene.ts  # Final Desejo Traído
│   │       └── EndingCScene.ts  # Final O Fantoche
│   │
│   ├── entities/
│   │   ├── Plankton.ts          # jogador: movimento, laser, skill, recebimento de dano
│   │   ├── bosses/
│   │   │   ├── BaseBoss.ts      # classe abstrata: HP, fases, padrões, object pool de projéteis
│   │   │   ├── Patrick.ts       # herda BaseBoss — implementa m1, m2, onFinalPhase
│   │   │   ├── Lula.ts
│   │   │   ├── Sandy.ts
│   │   │   ├── Bob.ts
│   │   │   ├── Gary.ts          # entidade separada instanciada pela Phase4Scene
│   │   │   └── FinalBoss.ts     # Homem Sereia e Mexilhãozinho como entidade dupla
│   │   └── skills/
│   │       ├── BaseSkill.ts     # classe abstrata para skills
│   │       ├── HolandesSkill.ts # âncoras e barris — dois sub-ataques selecionáveis
│   │       └── BobSkill.ts      # bolhas e redes de águas-vivas
│   │
│   ├── systems/
│   │   ├── ChoiceSystem.ts      # registra escolhas, calcula peso moral, determina skill disponível
│   │   ├── SkillSystem.ts       # gerencia barra de skill, carregamento por dano, disparo
│   │   ├── HUDSystem.ts         # renderiza vida, pontos, barra de skill, fragmentos da fórmula
│   │   └── ScenarioSystem.ts    # spawna obstáculos do cenário por fase (tufos, holofotes, vigas)
│   │
│   └── services/
│       └── KarenService.ts      # chamadas à API da Anthropic com contexto acumulado do GameState
│
├── docs/
│   └── gdd.md                   # Game Design Document narrativo completo
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 5. FLUXO DE DADOS

O fluxo abaixo descreve como os sistemas se conectam durante uma fase de jogo. Entender esse fluxo é mais importante do que qualquer detalhe de implementação individual.

```
Jogador pressiona tecla de diálogo
          │
          ▼
    DialogScene captura input
          │
          ▼
    ChoiceSystem.registerChoice(option)
          │
          ├──► GameState.addChoice()         — grava a escolha com peso moral
          │         │
          │         └──► SaveManager.save()  — persiste no localStorage
          │
          ├──► EventBus.emit('choice:made')  — notifica sistemas interessados
          │
          └──► KarenService.getResponse()    — injeta GameState como contexto no prompt
                    │
                    ▼
              Anthropic API retorna fala da Karen
                    │
                    ▼
              HUDSystem renderiza a fala no HUD


Plankton atira laser e acerta o boss
          │
          ▼
    Phaser detecta colisão (overlap group)
          │
          ▼
    BaseBoss.receiveDamage(amount)
          │
          ├──► Atualiza HP interno
          │
          ├──► Verifica threshold de fase final
          │         │
          │         └──► Se HP <= threshold: onFinalPhase()
          │                   │
          │                   └──► EventBus.emit('boss:final-phase')
          │
          └──► EventBus.emit('boss:damaged', { currentHp, maxHp })
                    │
                    ▼
              HUDSystem atualiza barra de HP do boss
              SkillSystem.addCharge(damageDealt)


Boss é derrotado
          │
          ▼
    EventBus.emit('boss:defeated', { bossId, phase })
          │
          ├──► GameState.completePhase(phase)
          │
          ├──► SaveManager.save()
          │
          ├──► ChoiceSystem.evaluateSkillUnlock()
          │         │
          │         └──► Se moral suficiente: GameState.unlockBobSkill()
          │
          └──► Scene transiciona para DialogScene (pós-fase) ou CutsceneScene
```

---

## 6. CONTRATOS DE TIPOS — GameState

O GameState define os contratos de tipo que todos os sistemas usam. Implementar esses tipos primeiro antes de qualquer outra coisa.

```typescript
// src/state/GameState.ts

type SkillType = 'holandes' | 'bob' | null;
type MoralPath = 'empatico' | 'egoista' | 'neutro';
type BossId = 'patrick' | 'lula' | 'sandy' | 'bob' | 'final';
type EndingId = 'redenção' | 'desejo-traido' | 'fantoche';

interface Choice {
  phase: number;           // fase em que a escolha foi feita (1-5)
  bossId: BossId;
  optionKey: string;       // identificador da opção escolhida
  moralWeight: number;     // positivo = empático, negativo = egoísta
  timestamp: number;       // Date.now() — para ordenação
}

interface PhaseProgress {
  bossId: BossId;
  completed: boolean;
  choiceMade: string;      // optionKey da escolha feita antes da luta
  completedAt: number;
}

interface GameStateData {
  version: number;                        // para compatibilidade de saves futuros
  currentPhase: number;                   // 1 a 5, ou 6 para boss final
  choices: Choice[];                      // histórico completo de todas as escolhas
  moralScore: number;                     // soma de todos os moralWeight
  moralPath: MoralPath;                   // derivado do moralScore
  skillUnlocked: SkillType;              // definida após fase 4
  phasesProgress: Record<BossId, PhaseProgress>;
  karenaPersonalitySummary: string;       // resumo gerado pela LLM a cada fase, injetado no próximo prompt
  endingUnlocked: EndingId | null;
}

// Singleton — acesso global via GameState.getInstance()
class GameState {
  private static instance: GameState;
  private data: GameStateData;

  static getInstance(): GameState { ... }

  addChoice(choice: Omit<Choice, 'timestamp'>): void { ... }
  completePhase(bossId: BossId, choiceMade: string): void { ... }
  unlockSkill(skill: SkillType): void { ... }
  getMoralPath(): MoralPath { ... }        // derivado — calcula do moralScore atual
  determineEnding(): EndingId { ... }      // chamado ao final do boss final
  toJSON(): GameStateData { ... }          // para o SaveManager serializar
  fromJSON(data: GameStateData): void { ... } // para o SaveManager restaurar
}
```

---

## 7. CONTRATO DO BOSS — BaseBoss

Todos os bosses herdam de `BaseBoss`. A subclasse implementa os métodos abstratos e nunca sobrescreve a lógica de `update` sem chamar `super.update()`.

```typescript
// src/entities/bosses/BaseBoss.ts

interface BossConfig {
  hp: number;
  finalPhaseThreshold: number;  // porcentagem — ex: 0.30 para 30%
  m1Cooldown: number;           // ms entre ataques M1
  m2Cooldown: number;           // ms entre ataques M2
  finalPhaseSpeedMultiplier: number;
  finalPhaseDamageMultiplier: number;
}

abstract class BaseBoss extends Phaser.GameObjects.Container {
  protected config: BossConfig;
  protected currentHp: number;
  protected isFinalPhase: boolean = false;
  protected projectilePool: Phaser.GameObjects.Group; // object pool de projéteis

  // Implementados pela subclasse
  abstract m1(): void;
  abstract m2(): void;
  abstract onFinalPhase(): void;

  // Implementado na base — não sobrescrever sem super.update()
  update(time: number, delta: number): void {
    this.checkFinalPhase();
    this.handleAttackCooldowns(time, delta);
  }

  receiveDamage(amount: number): void {
    this.currentHp -= amount;
    EventBus.emit('boss:damaged', {
      currentHp: this.currentHp,
      maxHp: this.config.hp
    });
    if (this.currentHp <= 0) {
      EventBus.emit('boss:defeated', { bossId: this.getBossId() });
    }
  }

  private checkFinalPhase(): void {
    if (!this.isFinalPhase &&
        this.currentHp / this.config.hp <= this.config.finalPhaseThreshold) {
      this.isFinalPhase = true;
      this.onFinalPhase();
      EventBus.emit('boss:final-phase', { bossId: this.getBossId() });
    }
  }

  abstract getBossId(): BossId;
}
```

---

## 8. KAREN — CONTRATO DO SERVIÇO

Karen não tem memória entre chamadas. O histórico completo de escolhas e o resumo de personalidade são injetados no system prompt a cada requisição. O `karenaPersonalitySummary` é atualizado pela própria API ao final de cada fase — isso evita enviar o histórico completo em chamadas longas.

```typescript
// src/services/KarenService.ts

interface KarenRequest {
  trigger: string;          // o que acionou a fala da Karen
  gameState: GameStateData; // contexto completo injetado no prompt
}

interface KarenResponse {
  text: string;             // fala da Karen para exibir no HUD
  updatedPersonality: string; // resumo atualizado para salvar no GameState
}

async function getKarenResponse(request: KarenRequest): Promise<KarenResponse> {
  const systemPrompt = buildSystemPrompt(request.gameState);
  // chamada à API da Anthropic
  // retorna texto da fala + resumo de personalidade atualizado
}

function buildSystemPrompt(state: GameStateData): string {
  // Tom base derivado do caminho moral
  const tone = state.moralPath === 'empatico'
    ? 'preocupada, carinhosa, começando a questionar os planos do Plankton'
    : state.moralPath === 'egoista'
    ? 'fria, eficiente, reforçando as decisões egoístas do Plankton sem questionar'
    : 'neutra, levemente sarcástica, observadora';

  return `
    Você é Karen, a esposa computador do Plankton.
    Universo: Bob Esponja — Fenda do Biquini.
    Seu tom atual: ${tone}.
    Histórico de personalidade acumulado: ${state.karenaPersonalitySummary}.
    Fase atual: ${state.currentPhase} de 5.
    Score moral do Plankton: ${state.moralScore}.

    Regras de resposta:
    - Sempre em português brasileiro
    - Máximo de 2 frases por resposta
    - Nunca mencionar "score moral" ou "escolha boa/ruim" — você não sabe disso conscientemente
    - Responder como se estivesse realmente acompanhando o Plankton em tempo real
    - Ao final da resposta, incluir um campo JSON separado com o resumo atualizado da sua personalidade

    Formato de resposta:
    FALA: [sua fala aqui]
    PERSONALIDADE: [resumo de 1 frase do seu estado emocional atual]
  `;
}
```

---

## 9. OBJECT POOLING — REGRA DE PERFORMANCE

Todo objeto que é criado e destruído repetidamente durante o gameplay usa object pooling. Nunca usar `new` para projéteis, partículas ou efeitos temporários dentro do loop de jogo.

```typescript
// Dentro de BaseBoss — inicialização do pool
protected projectilePool: Phaser.GameObjects.Group;

create() {
  // Cria o pool com 30 projéteis inativos
  this.projectilePool = this.scene.add.group({
    classType: Projectile,
    maxSize: 30,
    runChildUpdate: true
  });
}

// Uso correto — pega do pool em vez de instanciar
fireProjectile(x: number, y: number, velocityX: number, velocityY: number) {
  const projectile = this.projectilePool.get(x, y) as Projectile;
  if (!projectile) return; // pool esgotado — não dispara

  projectile.setActive(true);
  projectile.setVisible(true);
  projectile.fire(velocityX, velocityY);
}

// O projétil se desativa ao sair da tela — volta ao pool
class Projectile extends Phaser.GameObjects.Sprite {
  update() {
    if (this.x < 0 || this.x > CONSTANTS.GAME_WIDTH ||
        this.y < 0 || this.y > CONSTANTS.GAME_HEIGHT) {
      this.setActive(false);
      this.setVisible(false);
    }
  }
}
```

---

## 10. SISTEMA DE ESCOLHAS — LÓGICA MORAL

O `ChoiceSystem` é o sistema mais crítico do jogo. Ele determina qual final o jogador receberá e se Bob Esponja oferece a aliança.

```typescript
// src/systems/ChoiceSystem.ts

// Pesos morais por fase — definidos no constants.ts
// Positivo = empático, negativo = egoísta
const MORAL_WEIGHTS = {
  phase1: { optionA: -1, optionB: 1 },  // Patrick
  phase2: { optionA: 1,  optionB: -2 }, // Lula
  phase3: { optionA: 2,  optionB: -1 }, // Sandy
  phase4: { optionA: 2,  optionB: -2 }, // Bob — maior peso por ser o pivô narrativo
};

// Thresholds para avaliação — definidos no constants.ts
const MORAL_THRESHOLDS = {
  BOB_OFFER_MINIMUM: 3,     // score mínimo para Bob oferecer aliança
  EMPATICO_MINIMUM: 3,      // score mínimo para caminho empático
  EGOISTA_MAXIMUM: -1,      // score máximo para caminho egoísta
};

class ChoiceSystem {
  registerChoice(phase: number, bossId: BossId, optionKey: string): void {
    const weight = MORAL_WEIGHTS[`phase${phase}`][optionKey];

    GameState.getInstance().addChoice({
      phase,
      bossId,
      optionKey,
      moralWeight: weight
    });

    EventBus.emit('choice:registered', { phase, optionKey, weight });
  }

  canBobOfferAlliance(): boolean {
    return GameState.getInstance().data.moralScore >= MORAL_THRESHOLDS.BOB_OFFER_MINIMUM;
  }

  evaluateSkillUnlock(): SkillType {
    const canUnlockBob = this.canBobOfferAlliance();
    // Bob só é desbloqueado se o jogador tiver score suficiente E aceitar a oferta
    // A aceitação é registrada como uma choice especial na Phase4Scene
    return canUnlockBob ? 'bob' : 'holandes';
  }
}
```

---

## 11. SISTEMA DE SKILL — BARRA E DISPARO

A barra de skill carrega com dano causado. O jogador escolhe entre dois sub-ataques ao ativar.

```typescript
// src/systems/SkillSystem.ts

interface SkillState {
  currentCharge: number;
  maxCharge: number;        // definido em constants.ts
  isReady: boolean;
  selectedSubAttack: 'primary' | 'secondary'; // âncora/barril ou bolha/rede
}

class SkillSystem {
  private state: SkillState;

  addCharge(damageDealt: number): void {
    this.state.currentCharge = Math.min(
      this.state.currentCharge + damageDealt * CONSTANTS.SKILL_CHARGE_RATE,
      this.state.maxCharge
    );
    this.state.isReady = this.state.currentCharge >= this.state.maxCharge;
    EventBus.emit('skill:charge-updated', { ...this.state });
  }

  activate(subAttack: 'primary' | 'secondary'): void {
    if (!this.state.isReady) return;

    const skill = this.getActiveSkill();
    skill.execute(subAttack);

    this.state.currentCharge = 0;
    this.state.isReady = false;
    EventBus.emit('skill:activated', { subAttack });
  }

  private getActiveSkill(): BaseSkill {
    const skillType = GameState.getInstance().data.skillUnlocked;
    return skillType === 'bob' ? new BobSkill(this.scene) : new HolandesSkill(this.scene);
  }
}
```

---

## 12. SAVE SYSTEM — ESTRUTURA DO LOCALSTORAGE

```typescript
// src/state/SaveManager.ts

const SAVE_KEY = 'fora-do-cardume-save';

class SaveManager {
  save(): void {
    const state = GameState.getInstance().toJSON();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    try {
      const data = JSON.parse(raw) as GameStateData;
      // Validar versão do save antes de carregar
      if (data.version !== CONSTANTS.SAVE_VERSION) {
        this.clearSave();
        return false;
      }
      GameState.getInstance().fromJSON(data);
      return true;
    } catch {
      this.clearSave();
      return false;
    }
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  clearSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
```

---

## 13. FLUXO DE SCENES — ORDEM DE EXECUÇÃO

```
BootScene
    │  carrega todos os assets (sprites, audio, backgrounds)
    ▼
MenuScene
    │  novo jogo → inicializa GameState limpo
    │  continuar → SaveManager.load() → restaura GameState
    ▼
CutsceneScene (prólogo)
    │  toca prologo.mp4
    │  ao terminar → transiciona automaticamente
    ▼
DialogScene (fase 1 — pré-Patrick)
    │  ChoiceSystem.registerChoice()
    │  KarenService.getResponse() → fala exibida no HUD
    ▼
Phase1Scene (Patrick)
    │  instancia Patrick, SkillSystem, HUDSystem, ScenarioSystem
    │  boss derrotado → EventBus.emit('boss:defeated')
    │  SaveManager.save()
    ▼
DialogScene (pós-Patrick — fala da Karen)
    ▼
[repetir para fases 2, 3, 4]
    ▼
Phase4Scene (Bob + Gary)
    │  se canBobOfferAlliance() → exibe oferta do Bob
    │  senão → apenas oferta do Holandês
    │  ChoiceSystem.registerChoice() para a escolha da skill
    │  GameState.unlockSkill()
    ▼
FinalScene (Homem Sereia e Mexilhãozinho)
    │  FinalBoss instanciado com forma baseada em GameState.getMoralPath()
    │  boss derrotado → GameState.determineEnding()
    ▼
EndingAScene / EndingBScene / EndingCScene
    │  toca vídeo do final correspondente
    │  exibe créditos
    ▼
MenuScene (loop)
```

---

## 14. ASSETS — CONVENÇÕES DE SPRITESHEET

Todo spritesheet segue a mesma convenção para que o Phaser carregue e anime de forma consistente.

| Animação | Frames | Tamanho do frame |
|---|---|---|
| idle | 4 frames | 64x64px |
| walk | 6 frames | 64x64px |
| attack | 4 frames | 64x64px |
| hurt | 2 frames | 64x64px |
| death | 6 frames | 64x64px |

Frames organizados em linha horizontal única por spritesheet. Nome do arquivo: `[personagem]-sheet.png`.

Exemplo de carregamento no BootScene:

```typescript
this.load.spritesheet('plankton', 'assets/sprites/plankton-sheet.png', {
  frameWidth: 64,
  frameHeight: 64
});
```

---

## 15. CONSTANTES — O QUE DEVE ESTAR EM constants.ts

Nunca hardcodar os valores abaixo fora de `src/config/constants.ts`.

```typescript
// src/config/constants.ts

export const CONSTANTS = {
  // Resolução
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,

  // Save
  SAVE_VERSION: 1,

  // Skill
  SKILL_MAX_CHARGE: 100,
  SKILL_CHARGE_RATE: 0.5,       // multiplicador sobre dano causado

  // Moral
  BOB_OFFER_MINIMUM: 3,
  EMPATICO_MINIMUM: 3,
  EGOISTA_MAXIMUM: -1,

  // Boss — thresholds de fase final
  PATRICK_FINAL_PHASE: 0.30,
  LULA_FINAL_PHASE: 0.35,
  SANDY_FINAL_PHASE: 0.30,
  BOB_FINAL_PHASE: 0.25,
  FINAL_BOSS_FINAL_PHASE: 0.40,

  // Boss — HP base
  PATRICK_HP: 300,
  LULA_HP: 500,
  SANDY_HP: 700,
  BOB_HP: 900,
  FINAL_BOSS_HP: 1200,

  // Final Boss — multiplicadores Prime
  PRIME_HP_MULTIPLIER: 1.5,
  PRIME_SPEED_MULTIPLIER: 1.4,
  PRIME_DAMAGE_MULTIPLIER: 1.3,

  // Plankton
  PLANKTON_SPEED: 200,
  PLANKTON_LASER_DAMAGE: 25,
  PLANKTON_MAX_HP: 3,

  // Karen API
  KAREN_MAX_TOKENS: 150,

  // Cenário — Patrick
  COTTON_SPAWN_INTERVAL: 3000,    // ms
  COTTON_SLOW_DURATION: 2000,     // ms

  // Cenário — Lula
  SPOTLIGHT_PRECISION_DURATION: 3000, // ms

  // Cenário — Sandy
  PANEL_SPEED_BOOST_DURATION: 5000,   // ms

  // Cenário — Bob
  VIGA_FALL_INTERVAL: 4000,           // ms

  // Final Boss
  CURRENT_CHANGE_INTERVAL: 15000,     // ms
  VULNERABILITY_WINDOW: 2000,         // ms após redemoinho
};
```

---

## 16. VARIÁVEIS DE AMBIENTE

```
# .env
VITE_ANTHROPIC_API_KEY=sua_chave_aqui
```

Acesso no código:

```typescript
const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
```

Nunca commitar o `.env`. Adicionar ao `.gitignore`.

---

## 17. ORDEM DE IMPLEMENTAÇÃO RECOMENDADA

Seguir esta ordem garante que cada camada tem dependências resolvidas antes de ser usada.

```
1. constants.ts e phaser.config.ts
2. EventBus.ts
3. GameState.ts + SaveManager.ts
4. BootScene.ts + MenuScene.ts
5. Plankton.ts
6. BaseBoss.ts
7. ChoiceSystem.ts
8. HUDSystem.ts
9. Phase1Scene.ts + Patrick.ts   ← primeira fase jogável
10. DialogScene.ts
11. KarenService.ts
12. SkillSystem.ts
13. BaseSkill.ts + HolandesSkill.ts + BobSkill.ts
14. ScenarioSystem.ts
15. Phase2Scene.ts + Lula.ts
16. Phase3Scene.ts + Sandy.ts
17. Phase4Scene.ts + Bob.ts + Gary.ts
18. FinalBoss.ts + FinalScene.ts
19. CutsceneScene.ts
20. EndingAScene.ts + EndingBScene.ts + EndingCScene.ts
```

---

*Fora do Cardume • Documentação Técnica de Arquitetura • v1.0 • 2025*
