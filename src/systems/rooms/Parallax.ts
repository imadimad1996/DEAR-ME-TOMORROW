import * as PIXI from 'pixi.js';
import { Easing } from '../../utils/easing';

interface LayerEntry {
  sprite: PIXI.Sprite;
  factor: number;
  baseX: number;
  baseY: number;
}

export class Parallax {
  public readonly container = new PIXI.Container();
  private layers: LayerEntry[] = [];
  private targetX = 0;
  private targetY = 0;

  public addLayer(texturePath: string, factor: number, width: number, height: number): PIXI.Sprite {
    const sprite = PIXI.Sprite.from(texturePath);
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = 0.96;
    this.container.addChild(sprite);
    this.layers.push({
      sprite,
      factor,
      baseX: 0,
      baseY: 0,
    });
    return sprite;
  }

  public setDragOffset(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  public release(): void {
    this.targetX = 0;
    this.targetY = 0;
  }

  public update(deltaMs: number): void {
    const blend = Easing.easeOutQuad(Math.min(1, deltaMs / 120));
    this.layers.forEach((layer) => {
      layer.sprite.x += (layer.baseX + this.targetX * layer.factor - layer.sprite.x) * blend;
      layer.sprite.y += (layer.baseY + this.targetY * layer.factor - layer.sprite.y) * blend;
    });
  }
}
