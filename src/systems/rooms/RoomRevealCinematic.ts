import * as PIXI from 'pixi.js';
import type { TweenManager } from '../../engine/Tween';
import type { VFXPool } from '../../engine/VFXPool';

export class RoomRevealCinematic {
  constructor(
    private readonly stage: PIXI.Container,
    private readonly tween: TweenManager,
    private readonly vfx: VFXPool,
  ) {}

  public playEntranceHallReveal(onDone?: () => void): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x0b1118, 0.6).drawRect(0, 0, 1080, 1920).endFill();
    this.stage.addChild(overlay);

    this.vfx.burst(540, 960, 0xf4c542, 40, 180, 1200);

    this.tween.to(this.stage.scale, { x: 1.03, y: 1.03 }, 800, undefined, () => {
      this.tween.to(this.stage.scale, { x: 1, y: 1 }, 1200);
    });

    this.tween.to(overlay, { alpha: 0 }, 2000, undefined, () => {
      overlay.removeFromParent();
      onDone?.();
    });
  }
}
