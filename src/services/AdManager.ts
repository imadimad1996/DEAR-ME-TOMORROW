import { toDayKey } from './Time';

export type AdPlacement =
  | 'energy_empty'
  | 'double_order_reward'
  | 'echo_bonus'
  | 'daily_task_skip'
  | 'inventory_expand_offer';

export interface AdResult {
  success: boolean;
  placement: AdPlacement;
  reason?: string;
}

interface PlacementCounter {
  dayKey: string;
  count: number;
  lastWatchAt: number;
}

export class AdManager {
  private counters = new Map<AdPlacement, PlacementCounter>();

  constructor(private readonly rng: () => number) {}

  public async watch(
    placement: AdPlacement,
    options?: {
      cooldownSeconds?: number;
      dailyCap?: number;
    },
  ): Promise<AdResult> {
    const now = Date.now();
    const dayKey = toDayKey(now);
    const entry = this.counters.get(placement) ?? {
      dayKey,
      count: 0,
      lastWatchAt: 0,
    };

    if (entry.dayKey !== dayKey) {
      entry.dayKey = dayKey;
      entry.count = 0;
    }

    if (options?.dailyCap && entry.count >= options.dailyCap) {
      return {
        success: false,
        placement,
        reason: 'daily_cap_reached',
      };
    }

    if (options?.cooldownSeconds && now - entry.lastWatchAt < options.cooldownSeconds * 1000) {
      return {
        success: false,
        placement,
        reason: 'cooldown',
      };
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    const success = this.rng() <= 0.9;
    entry.lastWatchAt = now;
    if (success) {
      entry.count += 1;
    }
    this.counters.set(placement, entry);

    return {
      success,
      placement,
      reason: success ? undefined : 'simulated_failure',
    };
  }
}
