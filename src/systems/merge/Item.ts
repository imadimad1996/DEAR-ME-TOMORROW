import * as PIXI from 'pixi.js';
import type { ChainId } from './ChainsData';

export interface Item {
  uid: string;
  chainId: ChainId;
  tier: number;
  x: number;
  y: number;
  echo: boolean;
  isJoker: boolean;
  sprite: PIXI.Sprite;
}
