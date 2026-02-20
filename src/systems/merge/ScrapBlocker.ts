import * as PIXI from 'pixi.js';

function key(x: number, y: number): string {
  return `${x}:${y}`;
}

export class ScrapBlocker {
  private blocked = new Set<string>();
  private layer = new PIXI.Container();

  public attach(container: PIXI.Container): void {
    container.addChild(this.layer);
  }

  public randomize(boardWidth: number, boardHeight: number, count: number): void {
    this.blocked.clear();
    while (this.blocked.size < count) {
      const x = Math.floor(Math.random() * boardWidth);
      const y = Math.floor(Math.random() * boardHeight);
      this.blocked.add(key(x, y));
    }
  }

  public isBlocked(x: number, y: number): boolean {
    return this.blocked.has(key(x, y));
  }

  public clearAt(x: number, y: number): boolean {
    return this.blocked.delete(key(x, y));
  }

  public count(): number {
    return this.blocked.size;
  }

  public render(cellSize: number): void {
    this.layer.removeChildren();
    this.blocked.forEach((entry) => {
      const [xRaw, yRaw] = entry.split(':');
      const x = Number(xRaw);
      const y = Number(yRaw);

      const card = new PIXI.Graphics();
      card.beginFill(0x66513e, 0.86).drawRoundedRect(0, 0, cellSize - 8, cellSize - 8, 10).endFill();
      card.lineStyle(2, 0xc8a982, 0.8).drawRoundedRect(0, 0, cellSize - 8, cellSize - 8, 10);
      card.position.set(x * cellSize + 4, y * cellSize + 4);

      const cross = new PIXI.Graphics();
      cross.lineStyle(3, 0xf6f1e9, 0.9);
      cross.moveTo(card.x + 12, card.y + 12).lineTo(card.x + cellSize - 20, card.y + cellSize - 20);
      cross.moveTo(card.x + cellSize - 20, card.y + 12).lineTo(card.x + 12, card.y + cellSize - 20);

      this.layer.addChild(card, cross);
    });
  }
}
