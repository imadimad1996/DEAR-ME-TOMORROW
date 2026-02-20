import * as PIXI from 'pixi.js';
import { Button } from '../../ui/Button';
import type { BoosterInventory, BoosterType } from './BoosterSystem';
import { UITheme } from '../../ui/UITheme';

const SLOT_TYPES: Array<BoosterType | null> = [
  'extra_energy',
  'merge_joker',
  'time_skip',
  null,
  null,
  null,
  null,
  null,
];

export class BoosterUI {
  public readonly container = new PIXI.Container();
  private readonly buttons: Button[] = [];
  private readonly labels: PIXI.Text[] = [];

  constructor(onUse: (type: BoosterType) => void) {
    SLOT_TYPES.forEach((type, index) => {
      const x = 24 + index * 130;
      const y = 1770;

      const card = new PIXI.Graphics();
      card.beginFill(0x163049, 0.92).drawRoundedRect(0, 0, 120, 130, 14).endFill();
      card.lineStyle(2, UITheme.colors.gold, 0.7).drawRoundedRect(0, 0, 120, 130, 14);
      card.position.set(x, y);

      const icon = PIXI.Sprite.from(`/assets/ui/booster_icons/booster_${index + 1}.png`);
      icon.anchor.set(0.5);
      icon.width = 56;
      icon.height = 56;
      icon.position.set(x + 60, y + 38);

      const label = new PIXI.Text('--', UITheme.text.small);
      label.anchor.set(0.5);
      label.position.set(x + 60, y + 104);
      this.labels.push(label);

      this.container.addChild(card, icon, label);

      if (type) {
        const button = new Button('Use', () => onUse(type), 86, 34);
        button.container.position.set(x + 18, y + 84);
        this.container.addChild(button.container);
        this.buttons.push(button);
      }
    });
  }

  public updateInventory(inventory: BoosterInventory): void {
    this.labels[0].text = `x${inventory.extra_energy}`;
    this.labels[1].text = `x${inventory.merge_joker}`;
    this.labels[2].text = `x${inventory.time_skip}`;
    for (let i = 3; i < this.labels.length; i += 1) {
      this.labels[i].text = 'Soon';
    }
  }

  public update(deltaMs: number): void {
    this.buttons.forEach((button) => button.update(deltaMs));
  }
}
