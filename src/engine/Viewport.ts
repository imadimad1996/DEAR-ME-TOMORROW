import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../game/constants';

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class Viewport {
  private state: ViewportState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  constructor(
    private readonly container: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  public fit(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);
    const width = VIRTUAL_WIDTH * scale;
    const height = VIRTUAL_HEIGHT * scale;
    const offsetX = (w - width) * 0.5;
    const offsetY = (h - height) * 0.5;

    this.canvas.width = VIRTUAL_WIDTH;
    this.canvas.height = VIRTUAL_HEIGHT;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.container.style.left = `${offsetX}px`;
    this.container.style.top = `${offsetY}px`;
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;

    this.state = {
      scale,
      offsetX,
      offsetY,
    };
  }

  public toVirtual(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.state.offsetX) / this.state.scale,
      y: (screenY - this.state.offsetY) / this.state.scale,
    };
  }

  public get(): ViewportState {
    return this.state;
  }
}
