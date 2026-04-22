import { CONSTANTS } from '../config/constants';

export type SkillType = 'holandes' | 'bob' | null;
export type MoralPath = 'empatico' | 'egoista' | 'neutro';
export type BossId = 'prologo' | 'patrick' | 'lula' | 'sandy' | 'bob' | 'final';
export type EndingId = 'redencao' | 'desejo-traido' | 'fantoche';

export interface Choice {
  phase: number;
  bossId: BossId;
  optionKey: string;
  moralWeight: number;
  timestamp: number;
}

export interface PhaseProgress {
  bossId: BossId;
  completed: boolean;
  choiceMade: string;
  completedAt: number;
}

export interface GameStateData {
  version: number;
  currentPhase: number;
  choices: Choice[];
  moralScore: number;
  moralPath: MoralPath;
  skillUnlocked: SkillType;
  phasesProgress: Partial<Record<BossId, PhaseProgress>>;
  karenaPersonalitySummary: string;
  endingUnlocked: EndingId | null;
}

function createInitialData(): GameStateData {
  return {
    version: CONSTANTS.SAVE_VERSION,
    currentPhase: 1,
    choices: [],
    moralScore: 0,
    moralPath: 'neutro',
    skillUnlocked: null,
    phasesProgress: {},
    karenaPersonalitySummary: '',
    endingUnlocked: null,
  };
}

export class GameState {
  private static instance: GameState;
  private data: GameStateData = createInitialData();

  private constructor() {}

  static getInstance(): GameState {
    if (!GameState.instance) GameState.instance = new GameState();
    return GameState.instance;
  }

  addChoice(choice: Omit<Choice, 'timestamp'>): void {
    const full: Choice = { ...choice, timestamp: Date.now() };
    this.data.choices.push(full);
    this.data.moralScore += choice.moralWeight;
    this.data.moralPath = this.getMoralPath();
  }

  completePhase(bossId: BossId, choiceMade: string): void {
    this.data.phasesProgress[bossId] = {
      bossId,
      completed: true,
      choiceMade,
      completedAt: Date.now(),
    };
    this.data.currentPhase += 1;
  }

  unlockSkill(skill: SkillType): void {
    this.data.skillUnlocked = skill;
  }

  getMoralPath(): MoralPath {
    if (this.data.moralScore >= CONSTANTS.EMPATICO_MINIMUM) return 'empatico';
    if (this.data.moralScore <= CONSTANTS.EGOISTA_MAXIMUM) return 'egoista';
    return 'neutro';
  }

  determineEnding(): EndingId {
    const path = this.getMoralPath();
    if (path === 'empatico' && this.data.skillUnlocked === 'bob') return 'redencao';
    if (path === 'empatico') return 'desejo-traido';
    return 'fantoche';
  }

  reset(): void {
    this.data = createInitialData();
  }

  toJSON(): GameStateData {
    return structuredClone(this.data);
  }

  fromJSON(data: GameStateData): void {
    this.data = structuredClone(data);
  }

  getData(): Readonly<GameStateData> {
    return this.data;
  }
}
