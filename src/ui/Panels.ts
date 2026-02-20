import * as PIXI from 'pixi.js';

export class SlidePanel {
  public readonly container = new PIXI.Container();
  private visibleTarget = false;
  private closedX = 0;
  private openX = 0;

  constructor(width: number, height: number, color = 0x1b2b3c) {
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 0.95).drawRoundedRect(0, 0, width, height, 18).endFill();
    bg.lineStyle(2, 0xf4c542, 0.8).drawRoundedRect(0, 0, width, height, 18);
    this.container.addChild(bg);
  }

  public configure(openX: number, closedX: number, y: number): void {
    this.openX = openX;
    this.closedX = closedX;
    this.container.position.set(closedX, y);
  }

  public setOpen(isOpen: boolean): void {
    this.visibleTarget = isOpen;
  }

  public update(deltaMs: number): void {
    const targetX = this.visibleTarget ? this.openX : this.closedX;
    const speed = Math.min(1, deltaMs / 120);
    this.container.x += (targetX - this.container.x) * speed;
  }
}
