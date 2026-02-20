export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public int(min: number, maxInclusive: number): number {
    if (maxInclusive <= min) {
      return min;
    }
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  public chooseWeighted<T>(entries: Array<{ value: T; weight: number }>): T {
    const total = entries.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) {
      return entries[0].value;
    }
    const roll = this.next() * total;
    let acc = 0;
    for (const entry of entries) {
      acc += Math.max(0, entry.weight);
      if (roll <= acc) {
        return entry.value;
      }
    }
    return entries[entries.length - 1].value;
  }

  public snapshot(): number {
    return this.state >>> 0;
  }
}
