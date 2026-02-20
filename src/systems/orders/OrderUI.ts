import * as PIXI from 'pixi.js';
import { SlidePanel } from '../../ui/Panels';
import { UITheme } from '../../ui/UITheme';
import { Button } from '../../ui/Button';
import type { ActiveOrder } from './OrdersSystem';

export class OrderUI {
  public readonly panel = new SlidePanel(360, 700);
  private readonly title = new PIXI.Text('Orders', UITheme.text.body);
  private readonly rows = new PIXI.Container();
  private readonly toggleButton: Button;
  private readonly rerollButtons: Button[] = [];
  private open = false;

  constructor(private readonly onReroll: (index: number) => void) {
    this.panel.configure(700, 1090, 220);
    this.title.position.set(20, 16);
    this.rows.position.set(20, 66);
    this.panel.container.addChild(this.title, this.rows);

    this.toggleButton = new Button('Orders', () => {
      this.open = !this.open;
      this.panel.setOpen(this.open);
    }, 180, 64);
    this.toggleButton.container.position.set(870, 150);
  }

  public attach(stage: PIXI.Container): void {
    stage.addChild(this.panel.container, this.toggleButton.container);
  }

  public setOrders(orders: ActiveOrder[]): void {
    this.rows.removeChildren();
    this.rerollButtons.length = 0;

    orders.forEach((order, index) => {
      const card = new PIXI.Graphics();
      card.beginFill(0x22384b, 0.95).drawRoundedRect(0, index * 124, 320, 112, 12).endFill();
      card.lineStyle(2, UITheme.colors.gold, 0.7).drawRoundedRect(0, index * 124, 320, 112, 12);

      const text = new PIXI.Text(
        `${order.chainId.toUpperCase()} T${order.tier}  ${order.progress}/${order.count}\nReward ${order.rewardCoins}c +${order.rewardEnergy}⚡`,
        UITheme.text.small,
      );
      text.position.set(12, index * 124 + 10);

      const reroll = new Button('↻', () => this.onReroll(index), 44, 44);
      reroll.container.position.set(264, index * 124 + 58);
      this.rerollButtons.push(reroll);

      this.rows.addChild(card, text, reroll.container);
    });
  }

  public pulseComplete(): void {
    this.panel.container.x += 10;
    window.setTimeout(() => {
      this.panel.container.x -= 10;
    }, 100);
  }

  public update(deltaMs: number): void {
    this.panel.update(deltaMs);
    this.toggleButton.update(deltaMs);
    this.rerollButtons.forEach((button) => button.update(deltaMs));
  }
}
