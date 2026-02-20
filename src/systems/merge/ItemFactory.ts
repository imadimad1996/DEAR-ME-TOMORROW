import * as PIXI from 'pixi.js';
import type { ChainId } from './ChainsData';
import { getTierData } from './ChainsData';

export class ItemFactory {
  constructor(private readonly cellSize: number) {}

  public createSprite(chainId: ChainId, tier: number): PIXI.Sprite {
    const tierData = getTierData(chainId, tier);
    const sprite = PIXI.Sprite.from(tierData.asset);
    sprite.anchor.set(0.5);
    sprite.width = this.cellSize * 0.82;
    sprite.height = this.cellSize * 0.82;
    sprite.tint = tierData.color;
    sprite.eventMode = 'static';
    return sprite;
  }
}
