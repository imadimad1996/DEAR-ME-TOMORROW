import * as PIXI from 'pixi.js';

export interface DragCallbacks<T> {
  getPayload: (target: PIXI.DisplayObject) => T | null;
  onStart: (payload: T, position: PIXI.IPointData) => void;
  onMove: (payload: T, position: PIXI.IPointData) => void;
  onEnd: (payload: T, position: PIXI.IPointData) => void;
}

export class DragInput<T> {
  private activePayload: T | null = null;

  constructor(
    private readonly stage: PIXI.Container,
    private readonly callbacks: DragCallbacks<T>,
  ) {}

  public bind(displayObject: PIXI.DisplayObject): void {
    displayObject.eventMode = 'static';
    displayObject.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      const payload = this.callbacks.getPayload(displayObject);
      if (!payload) {
        return;
      }
      this.activePayload = payload;
      this.callbacks.onStart(payload, event.global);
    });

    displayObject.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
      if (!this.activePayload) {
        return;
      }
      const payload = this.activePayload;
      this.activePayload = null;
      this.callbacks.onEnd(payload, event.global);
    });

    displayObject.on('pointerupoutside', (event: PIXI.FederatedPointerEvent) => {
      if (!this.activePayload) {
        return;
      }
      const payload = this.activePayload;
      this.activePayload = null;
      this.callbacks.onEnd(payload, event.global);
    });

    this.stage.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      if (!this.activePayload) {
        return;
      }
      this.callbacks.onMove(this.activePayload, event.global);
    });
  }
}
