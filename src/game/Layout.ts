import {
  BOARD_COLS,
  BOARD_ROWS,
  BOARD_GAP,
  BOARD_SLOT_SIZE,
  BOARD_X,
  BOARD_Y,
  INVENTORY_COLS,
  INVENTORY_GAP,
  INVENTORY_SLOT_SIZE,
  INVENTORY_X,
  INVENTORY_Y,
} from './constants';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boardSlotToRect(slot: number): Rect {
  const col = slot % BOARD_COLS;
  const row = Math.floor(slot / BOARD_COLS);
  return {
    x: BOARD_X + col * (BOARD_SLOT_SIZE + BOARD_GAP),
    y: BOARD_Y + row * (BOARD_SLOT_SIZE + BOARD_GAP),
    w: BOARD_SLOT_SIZE,
    h: BOARD_SLOT_SIZE,
  };
}

export function inventorySlotToRect(slot: number): Rect {
  const col = slot % INVENTORY_COLS;
  const row = Math.floor(slot / INVENTORY_COLS);
  return {
    x: INVENTORY_X + col * (INVENTORY_SLOT_SIZE + INVENTORY_GAP),
    y: INVENTORY_Y + row * (INVENTORY_SLOT_SIZE + INVENTORY_GAP),
    w: INVENTORY_SLOT_SIZE,
    h: INVENTORY_SLOT_SIZE,
  };
}

export function pointToBoardSlot(x: number, y: number): number | null {
  if (x < BOARD_X || y < BOARD_Y) {
    return null;
  }
  const col = Math.floor((x - BOARD_X) / (BOARD_SLOT_SIZE + BOARD_GAP));
  const row = Math.floor((y - BOARD_Y) / (BOARD_SLOT_SIZE + BOARD_GAP));
  if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
    return null;
  }
  const rect = boardSlotToRect(row * BOARD_COLS + col);
  if (!pointInRect(x, y, rect)) {
    return null;
  }
  return row * BOARD_COLS + col;
}

export function pointToInventorySlot(
  x: number,
  y: number,
  capacity: number,
  page = 0,
): number | null {
  if (x < INVENTORY_X || y < INVENTORY_Y) {
    return null;
  }
  const col = Math.floor((x - INVENTORY_X) / (INVENTORY_SLOT_SIZE + INVENTORY_GAP));
  const row = Math.floor((y - INVENTORY_Y) / (INVENTORY_SLOT_SIZE + INVENTORY_GAP));
  if (col < 0 || col >= INVENTORY_COLS || row < 0) {
    return null;
  }
  const localSlot = row * INVENTORY_COLS + col;
  const globalSlot = page * INVENTORY_COLS * 3 + localSlot;
  if (globalSlot >= capacity) {
    return null;
  }
  const rect = inventorySlotToRect(localSlot);
  if (!pointInRect(x, y, rect)) {
    return null;
  }
  return globalSlot;
}

export function inventoryGlobalToVisible(globalSlot: number, page: number): number | null {
  const offset = page * INVENTORY_COLS * 3;
  const local = globalSlot - offset;
  if (local < 0 || local >= INVENTORY_COLS * 3) {
    return null;
  }
  return local;
}

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

export function rectOverlapRatio(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const overlapArea = x * y;
  const smallerArea = Math.min(a.w * a.h, b.w * b.h);
  if (smallerArea <= 0) {
    return 0;
  }
  return overlapArea / smallerArea;
}

export function rectCenter(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}
