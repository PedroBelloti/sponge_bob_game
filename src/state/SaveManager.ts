import { CONSTANTS } from '../config/constants';
import { GameState } from './GameState';
import type { GameStateData } from './GameState';

const SAVE_KEY = 'fora-do-cardume-save';

export class SaveManager {
  save(): void {
    const state = GameState.getInstance().toJSON();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    try {
      const data = JSON.parse(raw) as GameStateData;
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
