export class Time {
  public timeScale = 1;
  public deltaMs = 16.67;
  public elapsedMs = 0;

  public update(rawDeltaMs: number): number {
    this.deltaMs = rawDeltaMs * this.timeScale;
    this.elapsedMs += this.deltaMs;
    return this.deltaMs;
  }

  public withScale(scale: number, durationMs: number): void {
    this.timeScale = scale;
    window.setTimeout(() => {
      this.timeScale = 1;
    }, durationMs);
  }
}
