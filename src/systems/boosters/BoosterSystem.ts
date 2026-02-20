export type BoosterType = 'extra_energy' | 'merge_joker' | 'time_skip';

export interface BoosterInventory {
  extra_energy: number;
  merge_joker: number;
  time_skip: number;
}

export class BoosterSystem {
  private inventory: BoosterInventory;

  constructor(initial?: Partial<BoosterInventory>) {
    this.inventory = {
      extra_energy: initial?.extra_energy ?? 2,
      merge_joker: initial?.merge_joker ?? 1,
      time_skip: initial?.time_skip ?? 1,
    };
  }

  public getInventory(): BoosterInventory {
    return { ...this.inventory };
  }

  public setInventory(next: BoosterInventory): void {
    this.inventory = { ...next };
  }

  public has(type: BoosterType): boolean {
    return this.inventory[type] > 0;
  }

  public consume(type: BoosterType): boolean {
    if (!this.has(type)) {
      return false;
    }
    this.inventory[type] -= 1;
    return true;
  }

  public grant(type: BoosterType, amount = 1): void {
    this.inventory[type] += amount;
  }
}
