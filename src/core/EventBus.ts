// ============================================================
// EventBus — Simple pub/sub event system
// ============================================================

import type { GameEventType, EventCallback, GameEvent } from '../types';

export class EventBus {
  private listeners = new Map<GameEventType, Set<EventCallback>>();

  on(type: GameEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  emit(type: GameEventType, data?: unknown): void {
    const event: GameEvent = { type, data };
    this.listeners.get(type)?.forEach(cb => cb(event));
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Global event bus instance */
export const events = new EventBus();
