import * as PIXI from 'pixi.js';
import type { IScene } from '../engine/SceneManager';
import type { GameContext } from '../engine/Game';
import { Button } from '../ui/Button';

type TileType = 'tile1' | 'tile2' | 'tile3' | 'tile4' | 'tile5' | 'tile6' | 'bomb' | 'time_boost';

interface Tile {
  x: number;
  y: number;
  type: TileType;
  sprite: PIXI.Sprite;
}

const TILE_TYPES: TileType[] = ['tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'];

export class MatchMiniModeScene implements IScene {
  public readonly id = 'match-mini';
  public readonly container = new PIXI.Container();

  private readonly board = new PIXI.Container();
  private readonly tiles: Tile[] = [];
  private readonly rows = 6;
  private readonly cols = 6;
  private readonly size = 110;
  private selected: Tile | null = null;
  private combo = 0;

  private readonly backButton: Button;
  private readonly comboText = new PIXI.Text('Combo x0', {
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 34,
    fill: 0xf6f1e9,
  });
  private readonly comboGlow = PIXI.Sprite.from('/assets/match_tiles/combo_glow.png');

  constructor(private readonly ctx: GameContext) {
    this.backButton = new Button('Back', () => this.ctx.sceneManager.switchTo('main-menu'), 160, 60);
    this.build();
    this.resetGrid();
  }

  public enter(_previousSceneId: string | null): void {}

  public exit(_nextSceneId: string): void {}

  public resize(_width: number, _height: number): void {}

  public update(deltaMs: number): void {
    this.backButton.update(deltaMs);
    this.comboGlow.alpha = 0.18 + Math.sin(Date.now() / 200) * 0.08;
  }

  private build(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x162739, 1).drawRect(0, 0, 1080, 1920).endFill();
    bg.beginFill(0x0f4c5c, 0.4).drawRect(0, 1300, 1080, 620).endFill();

    const title = new PIXI.Text('Match Mini-Mode (Stub)', {
      fontFamily: 'Georgia, serif',
      fontSize: 54,
      fill: 0xf4c542,
    });
    title.anchor.set(0.5);
    title.position.set(540, 120);

    this.board.position.set(210, 360);
    this.backButton.container.position.set(40, 40);

    this.comboGlow.position.set(430, 220);
    this.comboGlow.width = 220;
    this.comboGlow.height = 80;

    this.comboText.anchor.set(0.5);
    this.comboText.position.set(540, 260);

    this.container.addChild(bg, title, this.board, this.comboGlow, this.comboText, this.backButton.container);
  }

  private resetGrid(): void {
    this.board.removeChildren();
    this.tiles.length = 0;
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        this.createTile(x, y, this.randomType());
      }
    }
  }

  private createTile(x: number, y: number, type: TileType): Tile {
    const path = this.pathForType(type);
    const sprite = PIXI.Sprite.from(path);
    sprite.anchor.set(0.5);
    sprite.width = this.size - 8;
    sprite.height = this.size - 8;
    sprite.position.set(x * this.size + this.size / 2, y * this.size + this.size / 2);
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    const tile: Tile = { x, y, type, sprite };

    sprite.on('pointertap', () => {
      this.onTileTap(tile);
    });

    this.tiles.push(tile);
    this.board.addChild(sprite);
    return tile;
  }

  private onTileTap(tile: Tile): void {
    if (!this.selected) {
      this.selected = tile;
      tile.sprite.scale.set(1.1);
      return;
    }

    const a = this.selected;
    a.sprite.scale.set(1);

    if (a === tile) {
      this.selected = null;
      return;
    }

    if (!this.areAdjacent(a, tile)) {
      this.selected = tile;
      tile.sprite.scale.set(1.1);
      return;
    }

    this.swapTiles(a, tile);
    const matched = this.resolveMatches();
    if (!matched) {
      this.swapTiles(a, tile);
      this.combo = 0;
    } else {
      this.combo += 1;
    }

    this.comboText.text = `Combo x${this.combo}`;
    this.selected = null;
  }

  private resolveMatches(): boolean {
    const matchSet = new Set<Tile>();

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols - 2; x += 1) {
        const t1 = this.getTile(x, y);
        const t2 = this.getTile(x + 1, y);
        const t3 = this.getTile(x + 2, y);
        if (!t1 || !t2 || !t3) {
          continue;
        }
        if (this.isNormal(t1.type) && t1.type === t2.type && t2.type === t3.type) {
          matchSet.add(t1);
          matchSet.add(t2);
          matchSet.add(t3);
        }
      }
    }

    for (let x = 0; x < this.cols; x += 1) {
      for (let y = 0; y < this.rows - 2; y += 1) {
        const t1 = this.getTile(x, y);
        const t2 = this.getTile(x, y + 1);
        const t3 = this.getTile(x, y + 2);
        if (!t1 || !t2 || !t3) {
          continue;
        }
        if (this.isNormal(t1.type) && t1.type === t2.type && t2.type === t3.type) {
          matchSet.add(t1);
          matchSet.add(t2);
          matchSet.add(t3);
        }
      }
    }

    if (matchSet.size === 0) {
      return false;
    }

    matchSet.forEach((tile) => {
      const burst = PIXI.Sprite.from('/assets/match_tiles/match_burst_sheet.png');
      burst.anchor.set(0.5);
      burst.position.copyFrom(tile.sprite.position);
      burst.width = 80;
      burst.height = 80;
      burst.alpha = 0.9;
      this.board.addChild(burst);
      window.setTimeout(() => burst.removeFromParent(), 220);

      if (tile.type === 'bomb') {
        this.clearAround(tile.x, tile.y);
      } else if (tile.type === 'time_boost') {
        this.combo += 1;
      }

      tile.type = this.randomType();
      tile.sprite.texture = PIXI.Texture.from(this.pathForType(tile.type));
    });

    return true;
  }

  private clearAround(cx: number, cy: number): void {
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        const tile = this.getTile(x, y);
        if (!tile) {
          continue;
        }
        tile.type = this.randomType();
        tile.sprite.texture = PIXI.Texture.from(this.pathForType(tile.type));
      }
    }
  }

  private getTile(x: number, y: number): Tile | null {
    return this.tiles.find((tile) => tile.x === x && tile.y === y) ?? null;
  }

  private swapTiles(a: Tile, b: Tile): void {
    const ax = a.x;
    const ay = a.y;

    a.x = b.x;
    a.y = b.y;
    b.x = ax;
    b.y = ay;

    a.sprite.position.set(a.x * this.size + this.size / 2, a.y * this.size + this.size / 2);
    b.sprite.position.set(b.x * this.size + this.size / 2, b.y * this.size + this.size / 2);
  }

  private areAdjacent(a: Tile, b: Tile): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy === 1;
  }

  private randomType(): TileType {
    const special = Math.random();
    if (special < 0.05) {
      return 'bomb';
    }
    if (special < 0.1) {
      return 'time_boost';
    }
    return TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
  }

  private isNormal(type: TileType): boolean {
    return type.startsWith('tile');
  }

  private pathForType(type: TileType): string {
    if (type === 'bomb') {
      return '/assets/match_tiles/bomb_tile.png';
    }
    if (type === 'time_boost') {
      return '/assets/match_tiles/time_boost_tile.png';
    }
    return `/assets/match_tiles/${type}.png`;
  }
}
