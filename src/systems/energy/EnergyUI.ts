import * as PIXI from 'pixi.js';
import { UITheme } from '../../ui/UITheme';

export class EnergyUI {
  public readonly container = new PIXI.Container();
  private readonly frame = new PIXI.Graphics();
  private readonly fill = new PIXI.Graphics();
  private readonly wave = new PIXI.Graphics();
  private readonly label = new PIXI.Text('', UITheme.text.small);
  private fillRatio = 1;
  private targetRatio = 1;

  constructor() {
    this.frame.lineStyle(2, UITheme.colors.cream, 0.9).drawRoundedRect(0, 0, 250, 34, 16);
    this.fill.beginFill(0x53d6f0, 0.95).drawRoundedRect(2, 2, 246, 30, 14).endFill();
    this.wave.beginFill(0xffffff, 0.2).drawRoundedRect(-30, 2, 40, 30, 14).endFill();
    this.label.position.set(0, -28);

    this.container.addChild(this.fill, this.wave, this.frame, this.label);
  }

  public setEnergy(current: number, max: number): void {
    this.targetRatio = max > 0 ? current / max : 0;
    this.label.text = `Energy ${Math.floor(current)}/${Math.floor(max)}`;
  }

  public playRefillPulse(): void {
    this.container.alpha = 1;
    this.container.scale.set(1.04);
    window.setTimeout(() => {
      this.container.scale.set(1);
    }, 250);
  }

  public update(deltaMs: number): void {
    this.fillRatio += (this.targetRatio - this.fillRatio) * Math.min(1, deltaMs / 200);
    const width = Math.max(0, 246 * this.fillRatio);
    this.fill.width = width;
    this.wave.x += deltaMs * 0.22;
    if (this.wave.x > 250) {
      this.wave.x = -40;
    }
  }
}
