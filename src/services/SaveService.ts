import type { RemoteConfig } from '../types/content';
import type { GameState, SaveData, SaveDataV1, SaveDataV2 } from '../types/game';

const SAVE_KEY = 'merge_manor_letters_save_v2';
const LEGACY_KEY = 'merge_manor_letters_save_v1';

export class SaveService {
  public load(config: RemoteConfig): SaveData | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SaveDataV2;
        if (parsed.version === 2) {
          return parsed;
        }
      } catch {
        localStorage.removeItem(SAVE_KEY);
        return null;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      try {
        const parsed = JSON.parse(legacyRaw) as SaveDataV1;
        if (parsed.version === 1) {
          const migrated = this.migrateV1ToV2(parsed, config);
          this.write(migrated);
          return migrated;
        }
      } catch {
        localStorage.removeItem(LEGACY_KEY);
        return null;
      }
    }

    return null;
  }

  public saveFromState(state: GameState): void {
    const payload: SaveDataV2 = {
      version: 2,
      seed: state.seed,
      player_progress: state.player,
      inventory_state: {
        capacity: state.inventoryCapacity,
        items: Object.values(state.items).filter((item) => item.container === 'inventory'),
      },
      board_state: {
        width: state.boardWidth,
        height: state.boardHeight,
        items: Object.values(state.items).filter((item) => item.container === 'board'),
      },
      generator_states: Object.values(state.generators),
      episode_progress: {
        completedStepIds: state.episodeCompletedSteps,
        activeEpisodeStepId: state.episodeActiveStepId,
      },
      decor_choices: state.decor,
      letter_inbox: state.letters,
      echo_queue: state.echo,
      event_progress: state.liveOps,
      purchase_history: state.purchaseHistory,
      order_state: {
        active: state.ordersActive,
        queued: state.ordersQueued,
        reroll: state.reroll,
      },
      energy_state: state.energy,
      remote_config_cache: state.config,
      saved_at: Date.now(),
    };
    this.write(payload);
  }

  public clear(): void {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  }

  private write(payload: SaveDataV2): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }

  private migrateV1ToV2(v1: SaveDataV1, config: RemoteConfig): SaveDataV2 {
    const completed = v1.episode_progress.completedStepIds;
    return {
      ...v1,
      version: 2,
      episode_progress: {
        completedStepIds: completed,
        activeEpisodeStepId: completed.length > 0 ? completed[completed.length - 1] : undefined,
      },
      remote_config_cache: config,
    };
  }
}
