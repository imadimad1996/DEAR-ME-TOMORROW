import * as PIXI from 'pixi.js';
import type { TweenManager } from '../../engine/Tween';
import type { VFXPool } from '../../engine/VFXPool';
import type { AudioManager } from '../../engine/Audio';
import type { ChainId } from './ChainsData';
import { getTierData } from './ChainsData';
import { ItemFactory } from './ItemFactory';
import type { Item } from './Item';
import { canMerge, getMergeResult } from './MergeRules';
import { findMagnetCandidate } from './MagnetMerge';
import type { Analytics } from '../analytics/Analytics';
import { AnalyticsEvents } from '../analytics/Events';
import { ScrapBlocker } from './ScrapBlocker';

export interface BoardSaveItem {
  uid: string;
  chainId: ChainId;
  tier: number;
  x: number;
  y: number;
  echo: boolean;
  isJoker: boolean;
}

interface DragState {
  item: Item;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export interface BoardCallbacks {
  onMerged?: (item: Item) => void;
  onMergeFailed?: (message: string) => void;
  onLegendaryMerge?: (item: Item) => void;
  onShake?: (strength: number, durationMs: number) => void;
  onBoardClutter?: (blockedCells: number) => void;
}

export class Board {
  public readonly container = new PIXI.Container();
  private readonly itemLayer = new PIXI.Container();
  private readonly overlayLayer = new PIXI.Container();
  private readonly itemFactory: ItemFactory;
  private readonly occupancy: Array<string | null>;
  private readonly items = new Map<string, Item>();
  private readonly tmpPoint = new PIXI.Point();
  private uidCounter = 0;
  private dragState: DragState | null = null;
  private hasFirstMerge = false;

  constructor(
    public readonly cols: number,
    public readonly rows: number,
    public readonly cellSize: number,
    private readonly tween: TweenManager,
    private readonly vfxPool: VFXPool,
    private readonly audio: AudioManager,
    private readonly analytics: Analytics,
    private readonly scrapBlocker: ScrapBlocker,
    private readonly callbacks: BoardCallbacks,
  ) {
    this.itemFactory = new ItemFactory(cellSize);
    this.occupancy = Array.from({ length: cols * rows }, () => null);

    const frame = new PIXI.Graphics();
    frame.beginFill(0x0f202f, 0.84).drawRoundedRect(0, 0, cols * cellSize, rows * cellSize, 20).endFill();
    frame.lineStyle(3, 0xf4c542, 0.8).drawRoundedRect(0, 0, cols * cellSize, rows * cellSize, 20);
    this.container.addChild(frame);

    const grid = new PIXI.Graphics();
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        grid.lineStyle(1, 0x5f7f94, 0.28);
        grid.drawRoundedRect(x * cellSize + 3, y * cellSize + 3, cellSize - 6, cellSize - 6, 10);
      }
    }

    this.container.addChild(grid, this.scrapBlockerLayer(), this.itemLayer, this.overlayLayer);

    this.container.eventMode = 'static';
    this.container.hitArea = new PIXI.Rectangle(0, 0, cols * cellSize, rows * cellSize);
    this.container.on('pointermove', (event: PIXI.FederatedPointerEvent) => this.onPointerMove(event));
    this.container.on('pointerup', (event: PIXI.FederatedPointerEvent) => this.onPointerUp(event));
    this.container.on('pointerupoutside', (event: PIXI.FederatedPointerEvent) => this.onPointerUp(event));
  }

  private scrapBlockerLayer(): PIXI.Container {
    const layer = new PIXI.Container();
    this.scrapBlocker.attach(layer);
    return layer;
  }

  public randomizeScrap(count: number): void {
    this.scrapBlocker.randomize(this.cols, this.rows, count);
    this.scrapBlocker.render(this.cellSize);
  }

  public clearScrapCell(x: number, y: number): boolean {
    const cleared = this.scrapBlocker.clearAt(x, y);
    if (cleared) {
      this.scrapBlocker.render(this.cellSize);
    }
    return cleared;
  }

  public clearRandomScrapCell(): boolean {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        if (this.clearScrapCell(x, y)) {
          return true;
        }
      }
    }
    return false;
  }

  public spawnItem(
    chainId: ChainId,
    tier: number,
    cellX?: number,
    cellY?: number,
    isJoker = false,
    forcedUid?: string,
  ): Item | null {
    const slot =
      cellX != null && cellY != null
        ? { x: cellX, y: cellY }
        : this.findFirstEmptyCell();

    if (!slot || this.scrapBlocker.isBlocked(slot.x, slot.y)) {
      this.callbacks.onBoardClutter?.(this.scrapBlocker.count());
      this.analytics.log(AnalyticsEvents.BOARD_CLUTTER_EVENTS, {
        blockedCells: this.scrapBlocker.count(),
        reason: 'spawn_failed',
      });
      return null;
    }

    const sprite = isJoker
      ? PIXI.Sprite.from(PIXI.Texture.WHITE)
      : this.itemFactory.createSprite(chainId, tier);

    if (isJoker) {
      sprite.tint = 0xff6f61;
      sprite.anchor.set(0.5);
      sprite.width = this.cellSize * 0.7;
      sprite.height = this.cellSize * 0.7;
    }

    const item: Item = {
      uid: forcedUid ?? this.nextUid(),
      chainId,
      tier,
      x: slot.x,
      y: slot.y,
      echo: false,
      isJoker,
      sprite,
    };

    this.items.set(item.uid, item);
    this.setOccupancy(slot.x, slot.y, item.uid);
    const center = this.cellCenter(slot.x, slot.y);
    sprite.position.set(center.x, center.y);

    this.bindItem(item);
    this.itemLayer.addChild(sprite);
    this.postPlacementCheck();

    return item;
  }

  public removeItem(uid: string): void {
    const item = this.items.get(uid);
    if (!item) {
      return;
    }
    this.setOccupancy(item.x, item.y, null);
    item.sprite.removeFromParent();
    this.items.delete(uid);
  }

  public getItems(): Item[] {
    return Array.from(this.items.values());
  }

  public getItem(uid: string): Item | null {
    return this.items.get(uid) ?? null;
  }

  public setItemEcho(uid: string, enabled: boolean): void {
    const item = this.items.get(uid);
    if (!item) {
      return;
    }
    item.echo = enabled;
    item.sprite.tint = enabled ? 0x9cecff : getTierData(item.chainId, item.tier).color;
  }

  public update(deltaMs: number, elapsedMs: number): void {
    const t = elapsedMs / 1000;
    this.items.forEach((item) => {
      if (item.tier === 8) {
        const pulse = 1 + Math.sin((t / 3.5) * Math.PI * 2) * 0.04;
        item.sprite.scale.set(pulse);
        item.sprite.rotation = Math.sin((t / 3.5) * Math.PI * 2) * (1.5 * Math.PI / 180);
        item.sprite.alpha = 0.9 + Math.sin((t / 3.5) * Math.PI * 2) * 0.1;
      } else {
        item.sprite.rotation *= 0.9;
        item.sprite.scale.set(1);
        item.sprite.alpha = 1;
      }

      if (item.echo) {
        item.sprite.y = this.cellCenter(item.x, item.y).y + Math.sin((elapsedMs + item.x * 90) / 400) * 3;
      }
    });
  }

  public toSaveItems(): BoardSaveItem[] {
    return this.getItems().map((item) => ({
      uid: item.uid,
      chainId: item.chainId,
      tier: item.tier,
      x: item.x,
      y: item.y,
      echo: item.echo,
      isJoker: item.isJoker,
    }));
  }

  public loadFromSave(items: BoardSaveItem[]): void {
    this.clearAll();
    items.forEach((entry) => {
      const spawned = this.spawnItem(
        entry.chainId,
        entry.tier,
        entry.x,
        entry.y,
        entry.isJoker,
        entry.uid,
      );
      if (spawned) {
        spawned.echo = entry.echo;
        spawned.sprite.tint = entry.echo ? 0x9cecff : getTierData(spawned.chainId, spawned.tier).color;
      }
    });
  }

  public clearAll(): void {
    this.items.forEach((item) => item.sprite.removeFromParent());
    this.items.clear();
    this.occupancy.fill(null);
  }

  private bindItem(item: Item): void {
    item.sprite.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      const local = this.container.toLocal(event.global, undefined, this.tmpPoint);
      this.dragState = {
        item,
        startX: item.x,
        startY: item.y,
        offsetX: item.sprite.x - local.x,
        offsetY: item.sprite.y - local.y,
      };
      this.itemLayer.setChildIndex(item.sprite, this.itemLayer.children.length - 1);
      this.audio.play('click', 0.3);
    });
  }

  private onPointerMove(event: PIXI.FederatedPointerEvent): void {
    if (!this.dragState) {
      return;
    }
    const local = this.container.toLocal(event.global, undefined, this.tmpPoint);
    this.dragState.item.sprite.x = local.x + this.dragState.offsetX;
    this.dragState.item.sprite.y = local.y + this.dragState.offsetY;
  }

  private onPointerUp(event: PIXI.FederatedPointerEvent): void {
    if (!this.dragState) {
      return;
    }

    const state = this.dragState;
    this.dragState = null;

    const local = this.container.toLocal(event.global, undefined, this.tmpPoint);
    const magnetCandidate = this.findMagnetCandidateNear(state.item, local.x, local.y, 20);
    if (magnetCandidate) {
      this.executeMerge(state.item, magnetCandidate, magnetCandidate.x, magnetCandidate.y, true);
      return;
    }

    const tx = Math.floor(local.x / this.cellSize);
    const ty = Math.floor(local.y / this.cellSize);

    if (!this.isCellInside(tx, ty) || this.scrapBlocker.isBlocked(tx, ty)) {
      this.snapItem(state.item, state.startX, state.startY);
      this.callbacks.onMergeFailed?.('Not soulmates yet.');
      return;
    }

    if (tx === state.startX && ty === state.startY) {
      this.snapItem(state.item, state.startX, state.startY);
      return;
    }

    const occupantUid = this.getOccupancy(tx, ty);
    if (!occupantUid) {
      this.moveItem(state.item, tx, ty, state.startX, state.startY);
      this.tryMagnetMerge(state.item);
      return;
    }

    const occupant = this.items.get(occupantUid);
    if (!occupant || !canMerge(state.item, occupant)) {
      this.snapItem(state.item, state.startX, state.startY);
      this.callbacks.onMergeFailed?.('Not soulmates yet.');
      return;
    }

    this.executeMerge(state.item, occupant, tx, ty, true);
  }

  private moveItem(item: Item, toX: number, toY: number, fromX: number, fromY: number): void {
    if (this.scrapBlocker.isBlocked(toX, toY)) {
      this.snapItem(item, fromX, fromY);
      return;
    }
    this.setOccupancy(fromX, fromY, null);
    this.setOccupancy(toX, toY, item.uid);
    item.x = toX;
    item.y = toY;
    this.snapItem(item, toX, toY);
  }

  private executeMerge(itemA: Item, itemB: Item, targetX: number, targetY: number, emitCallbacks: boolean): void {
    const result = getMergeResult(itemA, itemB);

    this.setOccupancy(itemA.x, itemA.y, null);
    this.setOccupancy(itemB.x, itemB.y, null);

    const center = this.cellCenter(targetX, targetY);
    const color = getTierData(result.chainId, Math.min(result.tier, 8)).color;

    this.audio.play('merge', 0.6);
    this.vfxPool.burst(center.x + this.container.x, center.y + this.container.y, color, 18, 40, 600);

    this.tween.to(itemB.sprite.scale, { x: 1.05, y: 1.05 }, 28, undefined, () => {
      this.tween.to(itemB.sprite.scale, { x: 0.95, y: 0.95 }, 28, undefined, () => {
        this.tween.to(itemB.sprite.scale, { x: 1, y: 1 }, 24);
      });
    });

    itemA.sprite.removeFromParent();
    itemB.sprite.removeFromParent();
    this.items.delete(itemA.uid);
    this.items.delete(itemB.uid);

    const merged = this.spawnItem(result.chainId, result.tier, targetX, targetY);
    if (!merged) {
      return;
    }

    this.callbacks.onShake?.(3.2, 150);

    if (!this.hasFirstMerge) {
      this.hasFirstMerge = true;
      this.analytics.log(AnalyticsEvents.TIME_TO_FIRST_MERGE, {
        sinceStartMs: performance.now(),
      });
    }

    this.analytics.log(AnalyticsEvents.MERGE_COUNT, {
      chainId: result.chainId,
      tier: result.tier,
    });
    this.analytics.log(AnalyticsEvents.MERGE_DEPTH, {
      depth: result.tier,
    });

    if (emitCallbacks) {
      this.callbacks.onMerged?.(merged);
      if (result.tier >= 8) {
        this.audio.play('legendary', 0.8);
        this.callbacks.onLegendaryMerge?.(merged);
      }
    }

    this.tryMagnetMerge(merged);
  }

  private tryMagnetMerge(item: Item): void {
    const candidate = findMagnetCandidate(this.getItems(), item, 20);
    if (!candidate) {
      return;
    }
    this.executeMerge(item, candidate, candidate.x, candidate.y, true);
  }

  private findMagnetCandidateNear(
    source: Item,
    localX: number,
    localY: number,
    thresholdPx: number,
  ): Item | null {
    let best: Item | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    this.items.forEach((item) => {
      if (!canMerge(source, item)) {
        return;
      }
      const dx = item.sprite.x - localX;
      const dy = item.sprite.y - localY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= thresholdPx && dist < bestDistance) {
        best = item;
        bestDistance = dist;
      }
    });
    return best;
  }

  private snapItem(item: Item, x: number, y: number): void {
    const center = this.cellCenter(x, y);
    this.tween.to(item.sprite, { x: center.x, y: center.y }, 90);
    item.x = x;
    item.y = y;
  }

  private cellCenter(x: number, y: number): { x: number; y: number } {
    return {
      x: x * this.cellSize + this.cellSize * 0.5,
      y: y * this.cellSize + this.cellSize * 0.5,
    };
  }

  private isCellInside(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  private index(x: number, y: number): number {
    return y * this.cols + x;
  }

  private getOccupancy(x: number, y: number): string | null {
    return this.occupancy[this.index(x, y)];
  }

  private setOccupancy(x: number, y: number, uid: string | null): void {
    this.occupancy[this.index(x, y)] = uid;
  }

  private findFirstEmptyCell(): { x: number; y: number } | null {
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        if (this.scrapBlocker.isBlocked(x, y)) {
          continue;
        }
        if (!this.getOccupancy(x, y)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  private postPlacementCheck(): void {
    const hasSpace = this.findFirstEmptyCell() != null;
    if (!hasSpace) {
      this.callbacks.onBoardClutter?.(this.scrapBlocker.count());
      this.analytics.log(AnalyticsEvents.BOARD_CLUTTER_EVENTS, {
        blockedCells: this.scrapBlocker.count(),
        reason: 'board_full',
      });
    }
  }

  private nextUid(): string {
    this.uidCounter += 1;
    return `item_${Date.now().toString(36)}_${this.uidCounter.toString(36)}`;
  }
}
