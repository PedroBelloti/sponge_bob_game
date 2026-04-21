type BossId = 'patrick' | 'lula' | 'sandy' | 'bob' | 'final';

interface EventMap {
  'boss:damaged': { currentHp: number; maxHp: number };
  'boss:defeated': { bossId: BossId };
  'boss:final-phase': { bossId: BossId };
  'choice:registered': { phase: number; optionKey: string; weight: number };
  'choice:made': { phase: number; optionKey: string };
  'skill:charge-updated': { currentCharge: number; maxCharge: number; isReady: boolean };
  'skill:activated': { subAttack: 'primary' | 'secondary' };
  'phase:complete': { phase: number; bossId: BossId };
  'game:save': undefined;
  'prologo:bob-derrotado': undefined;
}

type EventCallback<T> = (data: T) => void;

class EventBusClass {
  private listeners: Map<string, Array<{ callback: EventCallback<unknown>; context?: unknown }>> = new Map();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>, context?: unknown): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ callback: callback as EventCallback<unknown>, context });
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.findIndex((entry) => entry.callback === callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const entry of list) {
      entry.callback.call(entry.context, data);
    }
  }
}

export const EventBus = new EventBusClass();
