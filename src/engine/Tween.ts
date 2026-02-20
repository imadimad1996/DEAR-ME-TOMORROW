import { Easing } from '../utils/easing';

interface TweenTask {
  target: Record<string, any>;
  keys: string[];
  from: Record<string, number>;
  to: Record<string, number>;
  durationMs: number;
  elapsedMs: number;
  easing: (t: number) => number;
  onComplete?: () => void;
}

export class TweenManager {
  private tweens: TweenTask[] = [];

  public to(
    target: Record<string, any>,
    to: Record<string, number>,
    durationMs: number,
    easing: (t: number) => number = Easing.easeOutQuad,
    onComplete?: () => void,
  ): void {
    const from: Record<string, number> = {};
    const keys = Object.keys(to);
    keys.forEach((key) => {
      from[key] = Number(target[key]);
    });
    this.tweens.push({
      target,
      keys,
      from,
      to,
      durationMs: Math.max(1, durationMs),
      elapsedMs: 0,
      easing,
      onComplete,
    });
  }

  public update(deltaMs: number): void {
    this.tweens = this.tweens.filter((tween) => {
      tween.elapsedMs += deltaMs;
      const t = Math.min(1, tween.elapsedMs / tween.durationMs);
      const eased = tween.easing(t);
      tween.keys.forEach((key) => {
        const start = tween.from[key];
        const end = tween.to[key];
        tween.target[key] = start + (end - start) * eased;
      });
      if (t >= 1) {
        tween.onComplete?.();
        return false;
      }
      return true;
    });
  }

  public clear(): void {
    this.tweens = [];
  }
}
