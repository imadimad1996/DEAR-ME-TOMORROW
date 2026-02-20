import type {
  ItemChainId,
  OrderType,
  RemoteConfig,
} from './content';

export type ContainerType = 'board' | 'inventory';

export interface ItemInstance {
  uid: string;
  itemId: string;
  chainId: ItemChainId;
  tier: number;
  container: ContainerType;
  slotIndex: number;
  createdAt: number;
  sourceGeneratorId?: string;
  isEcho: boolean;
  echoExpiresAt?: number;
  echoWarningStage?: '6h' | '1h' | '10m';
  inventoryExpiresAt?: number;
}

export interface GeneratorState {
  id: string;
  level: number;
  cooldownEndAt: number;
}

export interface EnergyState {
  current: number;
  max: number;
  lastTickAt: number;
  rvLastWatchAt: number;
  rvWatchesToday: number;
  rvDayKey: string;
}

export interface OrderInstance {
  instanceId: string;
  definitionId: string;
  type: OrderType;
  createdAt: number;
  expiresAt?: number;
  forcedAt: number;
}

export interface PlayerProgress {
  level: number;
  xp: number;
  xpToNext: number;
  coins: number;
  stars: number;
  gems: number;
  episode: number;
  onboardingFlags: Record<string, boolean>;
}

export interface DecorState {
  roomStyles: Record<string, string>;
  flags: Record<string, boolean>;
  currentRoomId: string;
  newRoomEnteredAt: number;
}

export interface LetterInboxEntry {
  id: string;
  title: string;
  body: string;
  mood: string;
  receivedAt: number;
  readAt?: number;
  isFavorite: boolean;
}

export interface EchoState {
  eligibleMergeMissCount: number;
  consecutiveMergeCount: number;
  activeEchoIds: string[];
  pendingEchoItemIds: string[];
  pendingBranchMomentIds: string[];
  choiceState?: {
    echoItemId: string;
    branchMomentId: string;
    openedAt: number;
    graceDeadlineAt?: number;
  };
}

export interface DailyTaskProgress {
  id: string;
  target: number;
  progress: number;
  complete: boolean;
}

export interface LiveOpsState {
  dailyTaskDayKey: string;
  dailyTasks: DailyTaskProgress[];
  bonusChestClaimed: boolean;
  loginDayKey: string;
  loginStreak: number;
  loginClaimedToday: boolean;
  weeklyEventWeekKey: string;
  weeklyEventPoints: number;
}

export interface RerollState {
  dayKey: string;
  freeUsed: boolean;
  gemCost: number;
}

export interface GeneratorSpawnResult {
  ok: boolean;
  reason?: string;
  spawnedItemId?: string;
}

export interface SaveDataV1 {
  version: 1;
  seed: number;
  player_progress: PlayerProgress;
  inventory_state: {
    capacity: number;
    items: ItemInstance[];
  };
  board_state: {
    width: number;
    height: number;
    items: ItemInstance[];
  };
  generator_states: GeneratorState[];
  episode_progress: {
    completedStepIds: string[];
  };
  decor_choices: DecorState;
  letter_inbox: LetterInboxEntry[];
  echo_queue: EchoState;
  event_progress: LiveOpsState;
  purchase_history: string[];
  order_state: {
    active: OrderInstance[];
    queued: OrderInstance[];
    reroll: RerollState;
  };
  energy_state: EnergyState;
  saved_at: number;
}

export interface SaveDataV2 {
  version: 2;
  seed: number;
  player_progress: PlayerProgress;
  inventory_state: {
    capacity: number;
    items: ItemInstance[];
  };
  board_state: {
    width: number;
    height: number;
    items: ItemInstance[];
  };
  generator_states: GeneratorState[];
  episode_progress: {
    completedStepIds: string[];
    activeEpisodeStepId?: string;
  };
  decor_choices: DecorState;
  letter_inbox: LetterInboxEntry[];
  echo_queue: EchoState;
  event_progress: LiveOpsState;
  purchase_history: string[];
  order_state: {
    active: OrderInstance[];
    queued: OrderInstance[];
    reroll: RerollState;
  };
  energy_state: EnergyState;
  remote_config_cache: RemoteConfig;
  saved_at: number;
}

export type SaveData = SaveDataV2;

export interface ToastMessage {
  id: string;
  text: string;
  createdAt: number;
}

export interface RuntimeUiState {
  showSettings: boolean;
  showDebug: boolean;
  showInbox: boolean;
  selectedLetterId?: string;
  showInventoryModal: boolean;
  showDecorModal: boolean;
  showOrderModal: boolean;
  showTooltipForItemId?: string;
  tooltipPosition?: { x: number; y: number };
  toasts: ToastMessage[];
  overlayFadeUntil: number;
  paused: boolean;
  inventoryPage: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface GameState {
  config: RemoteConfig;
  seed: number;
  now: number;
  boardWidth: number;
  boardHeight: number;
  items: Record<string, ItemInstance>;
  boardSlots: Array<string | null>;
  inventorySlots: Array<string | null>;
  inventoryCapacity: number;
  generators: Record<string, GeneratorState>;
  energy: EnergyState;
  player: PlayerProgress;
  decor: DecorState;
  letters: LetterInboxEntry[];
  echo: EchoState;
  ordersActive: OrderInstance[];
  ordersQueued: OrderInstance[];
  reroll: RerollState;
  liveOps: LiveOpsState;
  purchaseHistory: string[];
  episodeCompletedSteps: string[];
  episodeActiveStepId?: string;
  pendingInboxNotice?: string;
  ui: RuntimeUiState;
}
