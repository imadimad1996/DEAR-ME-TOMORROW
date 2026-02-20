import * as PIXI from 'pixi.js';
import { UITheme } from './UITheme';
import { formatCompact } from '../utils/format';

export interface TopBarValues {
  energy: number;
  energyMax: number;
  coins: number;
  gems: number;
  stars: number;
}

export class TopBar {
  public readonly container = new PIXI.Container();
  private readonly energyText = new PIXI.Text('', UITheme.text.small);
  private readonly coinText = new PIXI.Text('', UITheme.text.small);
  private readonly gemText = new PIXI.Text('', UITheme.text.small);
  private readonly starText = new PIXI.Text('', UITheme.text.small);
  private readonly energyFill = new PIXI.Graphics();
  private fillTarget = 1;
  private fillCurrent = 1;

  constructor() {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x102536, 0.92).drawRoundedRect(0, 0, 1080, 120, 0).endFill();
    bg.lineStyle(2, UITheme.colors.gold, 0.6).moveTo(0, 118).lineTo(1080, 118);

    this.energyFill.beginFill(0x6de3ff, 0.9).drawRoundedRect(28, 64, 220, 20, 10).endFill();

    const energyFrame = new PIXI.Graphics();
    energyFrame.lineStyle(2, UITheme.colors.cream, 0.9).drawRoundedRect(24, 60, 228, 28, 12);

    this.energyText.position.set(28, 24);
    this.coinText.position.set(300, 24);
    this.gemText.position.set(520, 24);
    this.starText.position.set(740, 24);

    this.container.addChild(bg, this.energyFill, energyFrame, this.energyText, this.coinText, this.gemText, this.starText);
  }

  public setValues(values: TopBarValues): void {
    this.energyText.text = `Energy ${Math.floor(values.energy)}/${values.energyMax}`;
    this.coinText.text = `Coins ${formatCompact(values.coins)}`;
    this.gemText.text = `Gems ${formatCompact(values.gems)}`;
    this.starText.text = `Stars ${formatCompact(values.stars)}`;
    this.fillTarget = values.energyMax > 0 ? values.energy / values.energyMax : 0;
  }

  public update(deltaMs: number): void {
    this.fillCurrent += (this.fillTarget - this.fillCurrent) * Math.min(1, deltaMs / 180);
    const width = Math.max(0, Math.min(220, 220 * this.fillCurrent));
    this.energyFill.width = width;
    this.energyFill.alpha = 0.85 + Math.sin(Date.now() / 400) * 0.08;
  }
}
