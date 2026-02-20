import type { Analytics } from '../analytics/Analytics';
import { AnalyticsEvents } from '../analytics/Events';
import { clamp } from '../../utils/clamp';

export interface EnergySave {
  current: number;
  max: number;
  regenMinutes: number;
  lastTickAt: number;
  zeroEvents: number;
  zeroDurationMs: number;
}

export class EnergySystem {
  private current: number;
  private readonly max: number;
  private readonly regenMinutes: number;
  private lastTickAt: number;
  private zeroStartedAt: number | null = null;
  private zeroEvents = 0;
  private zeroDurationMs = 0;

  constructor(
    max: number,
    regenMinutes: number,
    private readonly analytics: Analytics,
    current = max,
    lastTickAt = Date.now(),
  ) {
    this.max = max;
    this.current = current;
    this.regenMinutes = regenMinutes;
    this.lastTickAt = lastTickAt;
  }

  public spend(amount: number): boolean {
    if (this.current < amount) {
      return false;
    }
    this.current = clamp(this.current - amount, 0, this.max);
    if (this.current <= 0) {
      this.zeroEvents += 1;
      if (this.zeroStartedAt == null) {
        this.zeroStartedAt = Date.now();
      }
      this.analytics.log(AnalyticsEvents.ENERGY_ZERO_EVENTS, {
        total: this.zeroEvents,
      });
    }
    return true;
  }

  public grant(amount: number): void {
    this.current = clamp(this.current + amount, 0, this.max);
    if (this.current > 0 && this.zeroStartedAt != null) {
      this.zeroDurationMs += Date.now() - this.zeroStartedAt;
      this.zeroStartedAt = null;
      this.analytics.log(AnalyticsEvents.ENERGY_ZERO_DURATION, {
        ms: this.zeroDurationMs,
      });
    }
  }

  public update(now = Date.now()): void {
    const regenStepMs = this.regenMinutes * 60 * 1000;
    const elapsed = now - this.lastTickAt;
    if (elapsed <= 0) {
      return;
    }
    const regenAmount = Math.floor(elapsed / regenStepMs);
    if (regenAmount > 0) {
      this.grant(regenAmount);
      this.lastTickAt += regenAmount * regenStepMs;
    }
  }

  public getCurrent(): number {
    return this.current;
  }

  public getMax(): number {
    return this.max;
  }

  public getRegenMinutes(): number {
    return this.regenMinutes;
  }

  public toSave(): EnergySave {
    return {
      current: this.current,
      max: this.max,
      regenMinutes: this.regenMinutes,
      lastTickAt: this.lastTickAt,
      zeroEvents: this.zeroEvents,
      zeroDurationMs: this.zeroDurationMs,
    };
  }
}
