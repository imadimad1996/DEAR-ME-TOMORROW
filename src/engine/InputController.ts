export interface PointerData {
  id: number;
  x: number;
  y: number;
  time: number;
}

export interface InputCallbacks {
  onDown: (pointer: PointerData) => void;
  onMove: (pointer: PointerData) => void;
  onUp: (pointer: PointerData) => void;
}

export class InputController {
  private boundDown = (event: PointerEvent) => {
    this.callbacks.onDown({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    });
  };

  private boundMove = (event: PointerEvent) => {
    this.callbacks.onMove({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    });
  };

  private boundUp = (event: PointerEvent) => {
    this.callbacks.onUp({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    });
  };

  constructor(
    private readonly element: HTMLElement,
    private readonly callbacks: InputCallbacks,
  ) {}

  public start(): void {
    this.element.addEventListener('pointerdown', this.boundDown);
    window.addEventListener('pointermove', this.boundMove);
    window.addEventListener('pointerup', this.boundUp);
    window.addEventListener('pointercancel', this.boundUp);
  }

  public stop(): void {
    this.element.removeEventListener('pointerdown', this.boundDown);
    window.removeEventListener('pointermove', this.boundMove);
    window.removeEventListener('pointerup', this.boundUp);
    window.removeEventListener('pointercancel', this.boundUp);
  }
}
