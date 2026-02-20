import type { AnalyticsEventName } from './Events';

export interface AnalyticsEventRecord {
  name: AnalyticsEventName | string;
  at: number;
  params: Record<string, unknown>;
}

const BUFFER_KEY = 'dmt.analytics.buffer.v1';

export class Analytics {
  private readonly startedAt = Date.now();
  private readonly buffer: AnalyticsEventRecord[] = [];

  constructor() {
    window.addEventListener('beforeunload', () => {
      this.log('session_length', {
        seconds: Math.floor((Date.now() - this.startedAt) / 1000),
      });
      this.persist();
    });
  }

  public log(name: AnalyticsEventName | string, params: Record<string, unknown> = {}): void {
    const event: AnalyticsEventRecord = {
      name,
      at: Date.now(),
      params,
    };
    this.buffer.push(event);
    if (this.buffer.length > 500) {
      this.buffer.splice(0, this.buffer.length - 500);
    }
    this.persist();
    console.info('[analytics]', name, params);
  }

  public exportJSON(pretty = true): string {
    return JSON.stringify(this.buffer, null, pretty ? 2 : 0);
  }

  public downloadJSON(filename = 'analytics-export.json'): void {
    const blob = new Blob([this.exportJSON(true)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  public getBuffer(): AnalyticsEventRecord[] {
    return [...this.buffer];
  }

  private persist(): void {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(this.buffer));
  }
}
