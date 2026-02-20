export type ItemChainId = 'woodworking' | 'oceanic' | 'culinary' | 'tech';

export interface ItemTierData {
  id: string;
  tier: number;
  nameKey: string;
  color: string;
  shape: 'circle' | 'square' | 'diamond' | 'hex';
  sellValue: number;
  sourceGenerators: string[];
}

export interface ItemChainData {
  id: ItemChainId;
  nameKey: string;
  icon: string;
  tiers: ItemTierData[];
}

export interface GeneratorDropEntry {
  itemId: string;
  weight: number;
}

export interface GeneratorLevelData {
  level: number;
  cooldownSec: number;
  drops: GeneratorDropEntry[];
}

export interface GeneratorData {
  id: string;
  nameKey: string;
  chainBias: ItemChainId[];
  levels: GeneratorLevelData[];
}

export type OrderType =
  | 'renovation_order'
  | 'decor_choice_order'
  | 'cooking_order'
  | 'repair_craft_order'
  | 'guest_order'
  | 'mystery_clue_order';

export interface OrderRequirement {
  chainId: ItemChainId;
  tier: number;
  count: number;
}

export interface OrderDefinition {
  id: string;
  type: OrderType;
  titleKey: string;
  descriptionKey: string;
  timedSeconds?: number;
  minPlayerLevel: number;
  maxPlayerLevel: number;
  requirements: OrderRequirement[];
  rewards: {
    coins: number;
    stars: number;
    xp: number;
  };
  triggerLetterId?: string;
  triggerBranchMomentId?: string;
}

export interface RoomStyle {
  id: string;
  nameKey: string;
  color: string;
}

export interface RoomDefinition {
  id: string;
  nameKey: string;
  unlockedAtEpisode: number;
  styles: RoomStyle[];
}

export type LetterMood = 'hopeful' | 'mystery' | 'warm' | 'urgent' | 'reflective';

export interface LetterDefinition {
  id: string;
  titleKey: string;
  bodyKey: string;
  mood: LetterMood;
  trigger: string;
}

export interface EpisodeStep {
  id: string;
  descriptionKey: string;
  requiredAction: string;
}

export interface EpisodeDefinition {
  id: number;
  nameKey: string;
  unlockRoomId?: string;
  steps: EpisodeStep[];
}

export interface RemoteConfig {
  schemaVersion: number;
  features: {
    matchMiniModeEnabled: boolean;
    eventBoostEnabled: boolean;
    vipBonusEnabled: boolean;
  };
  energy: {
    max: number;
    regenSeconds: number;
    offlineRegenCap: number;
    generatorSpawnCost: number;
    miniModeEntryCost: number;
    rvReward: number;
    rvCooldownSeconds: number;
    rvDailyCap: number;
  };
  echo: {
    baseChance: number;
    earlyGameChance: number;
    earlyGameLevelCap: number;
    newRoomBoost: number;
    streakPerFiveMerges: number;
    streakMaxBonus: number;
    eventBoost: number;
    vipBoost: number;
    pityThreshold: number;
    maxActiveEchoes: number;
    echoLifetimeHours: number;
    choiceGraceSeconds: number;
    pendingQueueMax: number;
  };
  inventory: {
    baseSlots: number;
    maxSlots: number;
    expiryHours: number;
  };
  autosaveSeconds: number;
}

export interface BranchMomentDefinition {
  id: string;
  triggerOrderId: string;
  roomId: string;
  optionA: {
    id: string;
    title: string;
    description: string;
    decorFlag: string;
    letterId: string;
  };
  optionB: {
    id: string;
    title: string;
    description: string;
    decorFlag: string;
    letterId: string;
  };
}

export interface IapSku {
  id: string;
  displayName: string;
  priceText: string;
  reward: {
    coins?: number;
    stars?: number;
    gems?: number;
    energy?: number;
  };
}
