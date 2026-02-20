import type { BoardSaveItem } from './merge/Board';
import type { ActiveOrder } from './orders/OrdersSystem';
import type { EnergySave } from './energy/EnergySystem';
import type { BoosterInventory } from './boosters/BoosterSystem';
import type { LetterProgress } from './narrative/LettersSystem';
import type { EchoSave } from './echo/EchoSystem';

const SAVE_KEY = 'dmt.save.v1';

export interface SaveStateV1 {
  version: 1;
  currencies: {
    coins: number;
    gems: number;
    stars: number;
  };
  board: {
    items: BoardSaveItem[];
  };
  orders: {
    active: ActiveOrder[];
  };
  energy: EnergySave;
  room: {
    currentRoomId: string;
    style: 'classic' | 'modern' | 'future';
  };
  letters: {
    progress: LetterProgress[];
  };
  boosters: BoosterInventory;
  echo: EchoSave;
  savedAt: number;
}

export type SaveState = SaveStateV1;

export class SaveLoad {
  public load(): SaveState | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as SaveState;
      if (parsed.version === 1) {
        return parsed;
      }
      return this.migrateUnknown(parsed as any);
    } catch {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
  }

  public save(state: SaveState): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  public clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  private migrateUnknown(raw: any): SaveState {
    return {
      version: 1,
      currencies: {
        coins: Number(raw?.currencies?.coins ?? 0),
        gems: Number(raw?.currencies?.gems ?? 0),
        stars: Number(raw?.currencies?.stars ?? 0),
      },
      board: {
        items: Array.isArray(raw?.board?.items) ? raw.board.items : [],
      },
      orders: {
        active: Array.isArray(raw?.orders?.active) ? raw.orders.active : [],
      },
      energy: raw?.energy,
      room: {
        currentRoomId: raw?.room?.currentRoomId ?? 'entrance_hall',
        style: raw?.room?.style ?? 'classic',
      },
      letters: {
        progress: Array.isArray(raw?.letters?.progress) ? raw.letters.progress : [],
      },
      boosters: {
        extra_energy: Number(raw?.boosters?.extra_energy ?? 0),
        merge_joker: Number(raw?.boosters?.merge_joker ?? 0),
        time_skip: Number(raw?.boosters?.time_skip ?? 0),
      },
      echo: {
        activeItemIds: Array.isArray(raw?.echo?.activeItemIds) ? raw.echo.activeItemIds : [],
        triggers: Number(raw?.echo?.triggers ?? 0),
        mergesObserved: Number(raw?.echo?.mergesObserved ?? 0),
      },
      savedAt: Date.now(),
    };
  }
}
