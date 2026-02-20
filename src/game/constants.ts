export const VIRTUAL_WIDTH = 1080;
export const VIRTUAL_HEIGHT = 1920;
export const BOARD_COLS = 8;
export const BOARD_ROWS = 7;
export const BOARD_SLOT_SIZE = 118;
export const BOARD_GAP = 8;
export const BOARD_X = 40;
export const BOARD_Y = 220;

export const INVENTORY_COLS = 5;
export const INVENTORY_SLOT_SIZE = 94;
export const INVENTORY_GAP = 10;
export const INVENTORY_X = 70;
export const INVENTORY_Y = 1320;

export const ECHO_SLOT_RECT = {
  x: 430,
  y: 1650,
  w: 220,
  h: 180,
};

export const ORDER_DROP_RECT = {
  x: 140,
  y: 1650,
  w: 250,
  h: 180,
};

export const TRASH_RECT = {
  x: 880,
  y: 1660,
  w: 150,
  h: 150,
};

export const SLOT_COUNT = BOARD_COLS * BOARD_ROWS;
export const DRAG_THRESHOLD = 10;
export const SNAP_DISTANCE = 20;

export const SELL_VALUES_BY_TIER: Record<number, number> = {
  1: 1,
  2: 3,
  3: 8,
  4: 20,
  5: 50,
  6: 120,
  7: 300,
  8: 800,
};

export const GENERATOR_COOLDOWNS_SEC: Record<number, number> = {
  1: 30,
  2: 120,
  3: 300,
  4: 900,
  5: 1800,
  6: 3600,
  7: 7200,
};
