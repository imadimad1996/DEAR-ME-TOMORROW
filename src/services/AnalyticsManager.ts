import type { GameState } from '../types/game';

export interface AnalyticsEvent {
  name: string;
  at: number;
  payload?: Record<string, unknown>;
}

const MAX_EVENTS = 200;

export class AnalyticsManager {
  private events: AnalyticsEvent[] = [];

  public track(name: string, payload?: Record<string, unknown>): void {
    const event: AnalyticsEvent = {
      name,
      at: Date.now(),
      payload,
    };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    console.info('[analytics]', event.name, event.payload ?? {});
  }

  public getEvents(): AnalyticsEvent[] {
    return [...this.events].reverse();
  }

  public attachSessionLifecycle(getState: () => GameState): () => void {
    this.track('session_start', {
      level: getState().player.level,
      episode: getState().player.episode,
    });

    const onBeforeUnload = () => {
      const state = getState();
      this.track('session_end', {
        level: state.player.level,
        coins: state.player.coins,
      });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }

  public crashStub(error: unknown): void {
    this.track('crash_stub', {
      message: String(error),
    });
  }
}
