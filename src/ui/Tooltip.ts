import * as PIXI from 'pixi.js';
import { UITheme } from './UITheme';

export class Tooltip {
  public readonly container = new PIXI.Container();
  private readonly card = new PIXI.Graphics();
  private readonly text = new PIXI.Text('', UITheme.text.small);

  constructor() {
    this.container.visible = false;
    this.card.beginFill(0x0b1624, 0.95).drawRoundedRect(0, 0, 340, 120, 14).endFill();
    this.card.lineStyle(2, UITheme.colors.cyanGlow, 0.8).drawRoundedRect(0, 0, 340, 120, 14);
    this.text.position.set(16, 16);
    this.text.wordWrap = true;
    this.text.wordWrapWidth = 308;

    this.container.addChild(this.card, this.text);
    this.container.scale.set(0.95);
    this.container.alpha = 0;
  }

  public show(message: string, x: number, y: number): void {
    this.text.text = message;
    this.container.position.set(x, y);
    this.container.visible = true;
    this.container.alpha = 1;
    this.container.scale.set(1);
  }

  public hide(): void {
    this.container.visible = false;
  }
}
