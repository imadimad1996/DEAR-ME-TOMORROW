export class GameLoop {
  private rafId = 0;
  private running = false;
  private last = 0;

  constructor(private readonly onFrame: (deltaMs: number, now: number) => void) {}

  public start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) {
        return;
      }
      const delta = now - this.last;
      this.last = now;
      this.onFrame(delta, now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
