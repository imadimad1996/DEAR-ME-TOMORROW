import type { ChainId } from '../merge/ChainsData';
import type { Item } from '../merge/Item';
import type { Analytics } from '../analytics/Analytics';
import { AnalyticsEvents } from '../analytics/Events';

export interface OrderTemplate {
  id: string;
  chainId: ChainId;
  tier: number;
  count: number;
  rewardCoins: number;
  rewardEnergy: number;
  rewardBooster: number;
}

export interface ActiveOrder extends OrderTemplate {
  progress: number;
}

export interface OrderCompletionReward {
  coins: number;
  energy: number;
  booster: number;
}

export class OrdersSystem {
  private active: ActiveOrder[] = [];

  constructor(
    private readonly templates: OrderTemplate[],
    private readonly analytics: Analytics,
    private readonly maxOrders = 5,
  ) {
    this.refill();
  }

  public getActive(): ActiveOrder[] {
    return this.active;
  }

  public setActive(active: ActiveOrder[]): void {
    this.active = [...active];
    this.refill();
  }

  public onItemMerged(item: Item): OrderCompletionReward | null {
    let completedReward: OrderCompletionReward | null = null;

    this.active.forEach((order) => {
      if (order.chainId === item.chainId && order.tier === item.tier && order.progress < order.count) {
        order.progress += 1;
      }
      if (order.progress >= order.count && !completedReward) {
        completedReward = {
          coins: order.rewardCoins,
          energy: order.rewardEnergy,
          booster: order.rewardBooster,
        };
      }
    });

    if (completedReward) {
      const index = this.active.findIndex((order) => order.progress >= order.count);
      if (index >= 0) {
        this.active.splice(index, 1);
        this.refill();
      }
    }

    return completedReward;
  }

  public reroll(index: number): void {
    if (!this.active[index]) {
      return;
    }
    const removed = this.active[index];
    this.analytics.log(AnalyticsEvents.ORDER_ABANDONMENT, {
      orderId: removed.id,
      progress: removed.progress,
      target: removed.count,
    });
    this.active.splice(index, 1);
    this.refill();
  }

  public toSave(): ActiveOrder[] {
    return this.active.map((order) => ({ ...order }));
  }

  private refill(): void {
    while (this.active.length < this.maxOrders) {
      const template = this.templates[Math.floor(Math.random() * this.templates.length)];
      this.active.push({
        ...template,
        progress: 0,
      });
    }
  }
}
