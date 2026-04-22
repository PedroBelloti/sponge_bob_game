import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';
import { GameState } from '../state/GameState';
import { SaveManager } from '../state/SaveManager';
import type { BossId, EndingId, MoralPath } from '../state/GameState';

const MORAL_WEIGHTS: Record<string, Record<'A' | 'B', number>> = {
  prologo: { A:  2, B: -2 },
  patrick: { A: -1, B:  1 },
  lula:    { A:  1, B: -2 },
  sandy:   { A:  2, B: -1 },
  bob:     { A:  2, B: -2 },
} as const;

const BOSS_TO_PHASE: Record<BossId, number> = {
  prologo: 0,
  patrick: 1,
  lula:    2,
  sandy:   3,
  bob:     4,
  final:   5,
};

export class ChoiceSystem {
  private static instance: ChoiceSystem;

  private constructor() {}

  static getInstance(): ChoiceSystem {
    if (!ChoiceSystem.instance) ChoiceSystem.instance = new ChoiceSystem();
    return ChoiceSystem.instance;
  }

  registerChoice(bossId: BossId, optionKey: 'A' | 'B'): void {
    const weights = MORAL_WEIGHTS[bossId];
    const weight = weights ? weights[optionKey] : 0;

    GameState.getInstance().addChoice({
      phase:       BOSS_TO_PHASE[bossId],
      bossId,
      optionKey,
      moralWeight: weight,
    });

    EventBus.emit('choice:registered', { bossId, optionKey, weight } as never);

    SaveManager.getInstance().save();
  }

  canBobOfferAlliance(): boolean {
    return GameState.getInstance().getData().moralScore >= CONSTANTS.BOB_OFFER_MINIMUM;
  }

  evaluateEnding(): EndingId {
    return GameState.getInstance().determineEnding();
  }

  getCurrentMoralPath(): MoralPath {
    return GameState.getInstance().getMoralPath();
  }
}
