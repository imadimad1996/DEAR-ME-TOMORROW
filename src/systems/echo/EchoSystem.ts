import type { Item } from '../merge/Item';
import type { Analytics } from '../analytics/Analytics';
import { AnalyticsEvents } from '../analytics/Events';

export interface EchoSave {
  activeItemIds: string[];
  triggers: number;
  mergesObserved: number;
}

export class EchoSystem {
  private activeItemIds = new Set<string>();
  private triggers = 0;
  private mergesObserved = 0;

  constructor(
    private readonly chance: number,
    private readonly analytics: Analytics,
  ) {}

  public evaluateMerge(item: Item): boolean {
    this.mergesObserved += 1;
    const hit = Math.random() < this.chance;
    if (!hit) {
      this.trackFrequency();
      return false;
    }

    this.activeItemIds.add(item.uid);
    this.triggers += 1;
    this.trackFrequency();
    this.analytics.log(AnalyticsEvents.ECHO_TRIGGER_FREQUENCY, {
      triggerCount: this.triggers,
      mergesObserved: this.mergesObserved,
      ratio: this.triggers / Math.max(1, this.mergesObserved),
    });
    return true;
  }

  public clearIfMissing(existingIds: string[]): void {
    const whitelist = new Set(existingIds);
    Array.from(this.activeItemIds).forEach((id) => {
      if (!whitelist.has(id)) {
        this.activeItemIds.delete(id);
      }
    });
  }

  public isEcho(uid: string): boolean {
    return this.activeItemIds.has(uid);
  }

  public getActiveIds(): string[] {
    return Array.from(this.activeItemIds);
  }

  public toSave(): EchoSave {
    return {
      activeItemIds: this.getActiveIds(),
      triggers: this.triggers,
      mergesObserved: this.mergesObserved,
    };
  }

  public load(save: EchoSave): void {
    this.activeItemIds = new Set(save.activeItemIds);
    this.triggers = save.triggers;
    this.mergesObserved = save.mergesObserved;
  }

  private trackFrequency(): void {
    if (this.mergesObserved % 10 !== 0) {
      return;
    }
    this.analytics.log(AnalyticsEvents.ECHO_TRIGGER_FREQUENCY, {
      triggerCount: this.triggers,
      mergesObserved: this.mergesObserved,
      ratio: this.triggers / Math.max(1, this.mergesObserved),
    });
  }
}
