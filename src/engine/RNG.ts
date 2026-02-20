export class RNG {
  private state: number;

  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  public int(min: number, max: number): number {
    if (max <= min) {
      return min;
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  public pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}

export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
