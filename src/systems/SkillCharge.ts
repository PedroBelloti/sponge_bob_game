import { CONSTANTS } from '../config/constants';
import { EventBus } from '../core/EventBus';

/**
 * Barra de Habilidade Suprema — carrega com dano causado aos inimigos.
 * Quanto mais agressivo o jogador, mais rápido carrega (GDD).
 * Uma instância por luta (não é singleton — o estado zera com a cena).
 */
export class SkillCharge {
  private charge = 0;

  /** rateScale < 1 = carrega mais devagar (ex.: barra mais lenta no boss final). */
  constructor(private readonly rateScale: number = 1) {}

  addFromDamage(damage: number): void {
    if (this.isReady()) return;
    this.charge = Math.min(
      CONSTANTS.SKILL_MAX_CHARGE,
      this.charge + damage * CONSTANTS.SKILL_CHARGE_RATE * this.rateScale,
    );
    this.emitUpdate();
  }

  isReady(): boolean {
    return this.charge >= CONSTANTS.SKILL_MAX_CHARGE;
  }

  /** Consome a barra cheia. Retorna false se ainda não está pronta. */
  consume(): boolean {
    if (!this.isReady()) return false;
    this.charge = 0;
    this.emitUpdate();
    return true;
  }

  getPercent(): number {
    return this.charge / CONSTANTS.SKILL_MAX_CHARGE;
  }

  private emitUpdate(): void {
    EventBus.emit('skill:charge-updated', {
      currentCharge: this.charge,
      maxCharge: CONSTANTS.SKILL_MAX_CHARGE,
      isReady: this.isReady(),
    });
  }
}
