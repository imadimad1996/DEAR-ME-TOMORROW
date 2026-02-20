import * as PIXI from 'pixi.js';
import { UITheme } from './UITheme';

export class Button {
  public readonly container = new PIXI.Container();
  private readonly bg = new PIXI.Graphics();
  private readonly shine = new PIXI.Graphics();
  private readonly labelText: PIXI.Text;
  private elapsed = 0;

  constructor(
    label: string,
    private readonly onClick: () => void,
    width = 300,
    height = 74,
  ) {
    this.bg.beginFill(UITheme.colors.deepTeal, 0.95).drawRoundedRect(0, 0, width, height, 20).endFill();
    this.bg.lineStyle(2, UITheme.colors.gold, 0.9).drawRoundedRect(0, 0, width, height, 20);

    this.shine.beginFill(0xffffff, 0.16).drawRoundedRect(-40, 0, 64, height, 16).endFill();
    this.shine.blendMode = PIXI.BLEND_MODES.SCREEN;

    this.labelText = new PIXI.Text(label, UITheme.text.body);
    this.labelText.anchor.set(0.5);
    this.labelText.position.set(width * 0.5, height * 0.5);

    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.container.addChild(this.bg, this.shine, this.labelText);

    this.container.on('pointertap', () => {
      this.tapCompress();
      this.onClick();
    });
  }

  public setLabel(text: string): void {
    this.labelText.text = text;
  }

  public update(deltaMs: number): void {
    this.elapsed += deltaMs;

    const pulse = 1 + Math.sin((this.elapsed / 3000) * Math.PI * 2) * 0.015;
    this.container.scale.set(pulse, pulse);

    const shinePhase = (this.elapsed % 4000) / 4000;
    this.shine.x = -80 + shinePhase * 420;
  }

  private tapCompress(): void {
    this.container.scale.set(0.94);
    window.setTimeout(() => {
      this.container.scale.set(1);
    }, 180);
  }
}
