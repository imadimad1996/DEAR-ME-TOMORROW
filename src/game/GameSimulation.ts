import type { ContentRepository } from '../services/ContentRepository';
import { DeterministicRng } from '../services/Rng';
import { Store } from '../services/Store';
import type { AnalyticsManager } from '../services/AnalyticsManager';
import type { AdManager } from '../services/AdManager';
import type { IAPManager } from '../services/IAPManager';
import type { SaveService } from '../services/SaveService';
import type { Localization } from '../services/Localization';
import type {
  BranchMomentDefinition,
  OrderDefinition,
  OrderRequirement,
  RemoteConfig,
} from '../types/content';
import type {
  ContainerType,
  DailyTaskProgress,
  GameState,
  GeneratorSpawnResult,
  ItemInstance,
  OrderInstance,
  SaveData,
} from '../types/game';
import {
  BOARD_COLS,
  BOARD_ROWS,
  ECHO_SLOT_RECT,
  ORDER_DROP_RECT,
  SELL_VALUES_BY_TIER,
  SLOT_COUNT,
  SNAP_DISTANCE,
  TRASH_RECT,
} from './constants';
import {
  boardSlotToRect,
  inventoryGlobalToVisible,
  inventorySlotToRect,
  pointInRect,
  pointToBoardSlot,
  pointToInventorySlot,
  rectCenter,
} from './Layout';
import { makeId } from '../services/Id';
import { clamp, toDayKey, toWeekKey } from '../services/Time';
import type { RemoteConfigService } from '../services/RemoteConfigService';

export type DropOutcomeType =
  | 'moved'
  | 'merged'
  | 'invalid'
  | 'scrapped'
  | 'echo_slot'
  | 'order_drop';

export interface DropOutcome {
  type: DropOutcomeType;
  valid: boolean;
}

export interface DragPickup {
  itemId: string;
  rect: { x: number; y: number; w: number; h: number };
}

interface GameSimulationDeps {
  content: ContentRepository;
  localization: Localization;
  analytics: AnalyticsManager;
  adManager: AdManager;
  iapManager: IAPManager;
  saveService: SaveService;
  configService: RemoteConfigService;
}

const TASK_TEMPLATES: Array<{ id: string; target: number }> = [
  { id: 'spawn_generator', target: 10 },
  { id: 'merge_completed', target: 8 },
  { id: 'order_completed', target: 3 },
  { id: 'letter_read', target: 1 },
  { id: 'ad_watched', target: 1 },
];

const MERGE_STREAK_RESET_MS = 7000;
const PLAYER_NAME = 'Caretaker';

export class GameSimulation {
  private readonly content: ContentRepository;
  private readonly localization: Localization;
  private readonly analytics: AnalyticsManager;
  private readonly adManager: AdManager;
  private readonly iapManager: IAPManager;
  private readonly saveService: SaveService;
  private readonly configService: RemoteConfigService;

  private readonly store: Store<GameState>;
  private rng: DeterministicRng;
  private lastMergeAt = 0;
  private doubleTapCooldownByItem = new Map<string, number>();

  constructor(deps: GameSimulationDeps) {
    this.content = deps.content;
    this.localization = deps.localization;
    this.analytics = deps.analytics;
    this.adManager = deps.adManager;
    this.iapManager = deps.iapManager;
    this.saveService = deps.saveService;
    this.configService = deps.configService;

    const baseConfig = this.configService.get();
    const saved = this.saveService.load(baseConfig);
    const state = saved ? this.stateFromSave(saved) : this.createDefaultState(baseConfig);

    this.rng = new DeterministicRng(state.seed);
    this.store = new Store(state);
    this.applyOfflineRegen();
    this.restoreChoiceOnResume();
    this.syncEchoIdList();
  }

  public getState(): GameState {
    return this.store.getState();
  }

  public subscribe(listener: (state: GameState) => void): () => void {
    return this.store.subscribe(listener);
  }

  public tick(now: number): void {
    const state = this.store.getState();
    let dirty = false;
    state.now = now;

    dirty = this.ensureDailyResets(state) || dirty;
    dirty = this.tickEnergyRegen(state, now) || dirty;
    dirty = this.tickOrderExpiryAndForcing(state, now) || dirty;
    dirty = this.tickEchoWarningsAndExpiry(state, now) || dirty;
    dirty = this.tickInventoryExpiry(state, now) || dirty;
    dirty = this.tickPendingEchoQueue(state) || dirty;
    dirty = this.tickEchoChoiceGrace(state, now) || dirty;
    dirty = this.trimToasts(state, now) || dirty;

    if (now - this.lastMergeAt > MERGE_STREAK_RESET_MS && state.echo.consecutiveMergeCount !== 0) {
      state.echo.consecutiveMergeCount = 0;
      dirty = true;
    }

    if (dirty) {
      this.commit(state);
    }
  }

  public saveNow(): void {
    const state = this.store.getState();
    state.seed = this.rng.snapshot();
    this.saveService.saveFromState(state);
  }

  public resetSaveAndState(): void {
    this.saveService.clear();
    const next = this.createDefaultState(this.configService.get());
    this.rng = new DeterministicRng(next.seed);
    this.commit(next);
  }

  public async refreshRemoteConfig(): Promise<void> {
    const state = this.store.getState();
    const config = await this.configService.refresh();
    state.config = config;
    state.energy.max = config.energy.max;
    state.energy.current = clamp(state.energy.current, 0, state.energy.max);
    this.toast(state, 'Remote config refreshed');
    this.commit(state);
  }

  public setSoundEnabled(enabled: boolean): void {
    const state = this.store.getState();
    state.ui.soundEnabled = enabled;
    this.commit(state);
  }

  public setMusicEnabled(enabled: boolean): void {
    const state = this.store.getState();
    state.ui.musicEnabled = enabled;
    this.commit(state);
  }

  public toggleUiPanel(panel: 'settings' | 'debug' | 'inbox' | 'inventory' | 'orders'): void {
    const state = this.store.getState();
    if (panel === 'settings') {
      state.ui.showSettings = !state.ui.showSettings;
    }
    if (panel === 'debug') {
      state.ui.showDebug = !state.ui.showDebug;
    }
    if (panel === 'inbox') {
      state.ui.showInbox = !state.ui.showInbox;
      if (!state.ui.showInbox) {
        state.ui.selectedLetterId = undefined;
      }
    }
    if (panel === 'inventory') {
      state.ui.showInventoryModal = !state.ui.showInventoryModal;
    }
    if (panel === 'orders') {
      state.ui.showOrderModal = !state.ui.showOrderModal;
    }
    this.commit(state);
  }

  public closeDecorModal(): void {
    const state = this.store.getState();
    if (!state.echo.choiceState) {
      state.ui.showDecorModal = false;
      this.commit(state);
    }
  }

  public nextInventoryPage(direction: 1 | -1): void {
    const state = this.store.getState();
    const pageCount = Math.max(1, Math.ceil(state.inventoryCapacity / 15));
    state.ui.inventoryPage = clamp(state.ui.inventoryPage + direction, 0, pageCount - 1);
    this.commit(state);
  }

  public getItemRect(itemId: string): { x: number; y: number; w: number; h: number } | null {
    const state = this.store.getState();
    const item = state.items[itemId];
    if (!item) {
      return null;
    }
    if (item.container === 'board') {
      return boardSlotToRect(item.slotIndex);
    }

    const localSlot = inventoryGlobalToVisible(item.slotIndex, state.ui.inventoryPage);
    if (localSlot == null) {
      return null;
    }
    return inventorySlotToRect(localSlot);
  }

  public pickupAt(x: number, y: number): DragPickup | null {
    const state = this.store.getState();

    const boardSlot = pointToBoardSlot(x, y);
    if (boardSlot != null) {
      const id = state.boardSlots[boardSlot];
      if (id) {
        const rect = boardSlotToRect(boardSlot);
        return { itemId: id, rect };
      }
    }

    const inventorySlot = pointToInventorySlot(
      x,
      y,
      state.inventoryCapacity,
      state.ui.inventoryPage,
    );
    if (inventorySlot != null) {
      const id = state.inventorySlots[inventorySlot];
      if (id) {
        const localSlot = inventoryGlobalToVisible(inventorySlot, state.ui.inventoryPage);
        if (localSlot != null) {
          const rect = inventorySlotToRect(localSlot);
          return { itemId: id, rect };
        }
      }
    }

    return null;
  }

  public startTooltip(itemId: string, x: number, y: number): void {
    const state = this.store.getState();
    if (!state.items[itemId]) {
      return;
    }
    state.ui.showTooltipForItemId = itemId;
    state.ui.tooltipPosition = { x, y };
    this.commit(state);
  }

  public clearTooltip(): void {
    const state = this.store.getState();
    if (state.ui.showTooltipForItemId) {
      state.ui.showTooltipForItemId = undefined;
      state.ui.tooltipPosition = undefined;
      this.commit(state);
    }
  }

  public dropItem(itemId: string, dropX: number, dropY: number): DropOutcome {
    const state = this.store.getState();
    const item = state.items[itemId];
    if (!item) {
      return { type: 'invalid', valid: false };
    }

    if (pointInRect(dropX, dropY, TRASH_RECT)) {
      const success = this.tryScrapItem(state, itemId);
      if (success) {
        this.commit(state);
        return { type: 'scrapped', valid: true };
      }
      return { type: 'invalid', valid: false };
    }

    if (pointInRect(dropX, dropY, ECHO_SLOT_RECT) && item.isEcho) {
      const opened = this.openEchoChoiceForItem(state, itemId);
      if (opened) {
        this.commit(state);
        return { type: 'echo_slot', valid: true };
      }
      return { type: 'invalid', valid: false };
    }

    if (pointInRect(dropX, dropY, ORDER_DROP_RECT)) {
      const done = this.tryCompleteOrderByDraggedItem(state, itemId);
      if (done) {
        this.commit(state);
        return { type: 'order_drop', valid: true };
      }
      return { type: 'invalid', valid: false };
    }

    const target = this.resolveDropTarget(state, dropX, dropY);
    if (!target) {
      return { type: 'invalid', valid: false };
    }

    const targetItemId =
      target.container === 'board'
        ? state.boardSlots[target.slot]
        : state.inventorySlots[target.slot];

    if (targetItemId === itemId) {
      return { type: 'moved', valid: true };
    }

    if (targetItemId) {
      const targetItem = state.items[targetItemId];
      if (
        this.canItemsMerge(item, targetItem) &&
        (item.container === target.container || target.container === 'board')
      ) {
        const merged = this.mergeItems(state, itemId, targetItemId, target.container, target.slot);
        if (merged) {
          this.resolveChainReaction(state, target.container);
          this.commit(state);
          return { type: 'merged', valid: true };
        }
      }

      this.swapItems(state, itemId, targetItemId);
      this.commit(state);
      return { type: 'moved', valid: true };
    }

    this.moveItemTo(state, itemId, target.container, target.slot);
    this.commit(state);
    return { type: 'moved', valid: true };
  }

  public previewDropTarget(
    x: number,
    y: number,
  ): { container: ContainerType; slot: number } | null {
    const state = this.store.getState();
    return this.resolveDropTarget(state, x, y);
  }

  public getItem(itemId: string): ItemInstance | undefined {
    return this.store.getState().items[itemId];
  }

  public isEchoChoiceOpen(): boolean {
    return Boolean(this.store.getState().echo.choiceState);
  }

  public getItemTooltip(itemId: string): string | null {
    const state = this.store.getState();
    const item = state.items[itemId];
    if (!item) {
      return null;
    }
    const current = this.content.getItem(item.itemId);
    const next = this.content.getNextTierItem(item.itemId);
    const next2 = next ? this.content.getNextTierItem(next) : null;
    const source = item.sourceGeneratorId
      ? this.localization.t(this.content.getGenerator(item.sourceGeneratorId).nameKey)
      : 'Unknown';
    return [
      `${this.localization.t(current.nameKey)} (Tier ${item.tier})`,
      `Source: ${source}`,
      `Sell: ${SELL_VALUES_BY_TIER[item.tier] ?? 1}`,
      `Next: ${next ? this.localization.t(this.content.getItem(next).nameKey) : 'MAX'}`,
      `Then: ${next2 ? this.localization.t(this.content.getItem(next2).nameKey) : 'MAX'}`,
    ].join('\n');
  }

  public bulkScrapLowTier(): number {
    const state = this.store.getState();
    const candidates = Object.values(state.items).filter((item) => item.tier <= 2);
    if (candidates.length === 0) {
      this.toast(state, 'No tier 1-2 items to scrap');
      this.commit(state);
      return 0;
    }

    const ok = window.confirm(`Scrap ${candidates.length} tier 1-2 items?`);
    if (!ok) {
      return 0;
    }

    let totalCoins = 0;
    for (const item of candidates) {
      totalCoins += Math.floor((SELL_VALUES_BY_TIER[item.tier] ?? 1) * 1);
      this.deleteItem(state, item.uid);
    }
    state.player.coins += totalCoins;
    this.toast(state, `Bulk scrapped +${totalCoins} coins`);
    this.commit(state);
    return totalCoins;
  }

  public tryGeneratorSpawn(generatorId: string): GeneratorSpawnResult {
    const state = this.store.getState();
    const generator = state.generators[generatorId];
    if (!generator) {
      return { ok: false, reason: 'unknown_generator' };
    }

    if (state.energy.current < state.config.energy.generatorSpawnCost) {
      return { ok: false, reason: 'not_enough_energy' };
    }

    if (generator.cooldownEndAt > state.now) {
      return { ok: false, reason: 'cooldown' };
    }

    const source = this.content.getGenerator(generatorId);
    const levelData = source.levels.find((entry) => entry.level === generator.level) ?? source.levels[0];
    const selectedItemId = this.rng.chooseWeighted(
      levelData.drops.map((entry) => ({ value: entry.itemId, weight: entry.weight })),
    );

    state.energy.current -= state.config.energy.generatorSpawnCost;

    const emptyBoard = this.findFirstEmptyBoardSlot(state);
    const emptyInventory = this.findFirstEmptyInventorySlot(state);

    if (emptyBoard == null && emptyInventory == null) {
      this.toast(state, 'Board and inventory are full');
      return { ok: false, reason: 'no_space' };
    }

    const container: ContainerType = emptyBoard != null ? 'board' : 'inventory';
    const slot = emptyBoard != null ? emptyBoard : (emptyInventory as number);
    this.spawnItem(state, selectedItemId, container, slot, {
      sourceGeneratorId: generatorId,
      isEcho: false,
    });

    generator.cooldownEndAt = state.now + levelData.cooldownSec * 1000;
    this.analytics.track('generator_spawned', { generatorId, itemId: selectedItemId });
    this.recordAction(state, 'spawn_from_generator');
    this.incrementTask(state, 'spawn_generator', 1);
    this.commit(state);

    return {
      ok: true,
      spawnedItemId: selectedItemId,
    };
  }

  public async watchEnergyAdIfEligible(): Promise<boolean> {
    const state = this.store.getState();
    if (state.energy.current > 10) {
      this.toast(state, 'Energy ad appears only at 10 or less');
      this.commit(state);
      return false;
    }

    const result = await this.adManager.watch('energy_empty', {
      cooldownSeconds: state.config.energy.rvCooldownSeconds,
      dailyCap: state.config.energy.rvDailyCap,
    });

    if (!result.success) {
      this.toast(state, `Ad unavailable: ${result.reason}`);
      this.commit(state);
      return false;
    }

    state.energy.current = clamp(
      state.energy.current + state.config.energy.rvReward,
      0,
      state.energy.max,
    );
    state.energy.rvLastWatchAt = state.now;
    state.energy.rvWatchesToday += 1;

    this.analytics.track('ad_watched', { placement: 'energy_empty' });
    this.incrementTask(state, 'ad_watched', 1);
    this.toast(state, `+${state.config.energy.rvReward} energy`);
    this.commit(state);
    return true;
  }

  public async purchaseSku(skuId: string): Promise<void> {
    const state = this.store.getState();
    this.analytics.track('iap_purchase_started', { skuId });
    const result = await this.iapManager.purchase(skuId);
    if (!result.success) {
      this.analytics.track('iap_purchase_failed', { skuId, reason: result.reason });
      this.toast(state, `Purchase failed (${result.reason})`);
      this.commit(state);
      return;
    }

    const sku = this.content.iapCatalog.find((entry) => entry.id === skuId);
    if (sku) {
      state.player.coins += sku.reward.coins ?? 0;
      state.player.stars += sku.reward.stars ?? 0;
      state.player.gems += sku.reward.gems ?? 0;
      state.energy.current = clamp(state.energy.current + (sku.reward.energy ?? 0), 0, state.energy.max);
      state.purchaseHistory.push(result.transactionId ?? makeId('txn'));
    }

    this.analytics.track('iap_purchase_success', { skuId, transactionId: result.transactionId });
    this.toast(state, `Purchased ${sku?.displayName ?? skuId}`);
    this.commit(state);
  }

  public getReadyGeneratorIds(now: number): string[] {
    const state = this.store.getState();
    return Object.values(state.generators)
      .filter((generator) => generator.cooldownEndAt <= now)
      .map((generator) => generator.id);
  }

  public getInboxSorted(): Array<{ id: string; unread: boolean; receivedAt: number }> {
    const state = this.store.getState();
    return [...state.letters]
      .sort((a, b) => {
        const unreadDelta = Number(a.readAt != null) - Number(b.readAt != null);
        if (unreadDelta !== 0) {
          return unreadDelta;
        }
        return b.receivedAt - a.receivedAt;
      })
      .map((entry) => ({
        id: entry.id,
        unread: entry.readAt == null,
        receivedAt: entry.receivedAt,
      }));
  }

  public readLetter(letterId: string): void {
    const state = this.store.getState();
    const letter = state.letters.find((entry) => entry.id === letterId);
    if (!letter) {
      return;
    }
    if (letter.readAt == null) {
      letter.readAt = state.now;
      this.analytics.track('letter_read', { letterId });
      this.recordAction(state, 'read_letter');
      this.incrementTask(state, 'letter_read', 1);
    }
    state.ui.selectedLetterId = letterId;
    this.commit(state);
  }

  public toggleFavoriteLetter(letterId: string): void {
    const state = this.store.getState();
    const letter = state.letters.find((entry) => entry.id === letterId);
    if (!letter) {
      return;
    }

    if (!letter.isFavorite) {
      const count = state.letters.filter((entry) => entry.isFavorite).length;
      if (count >= 50) {
        this.toast(state, 'Favorite limit reached');
        this.commit(state);
        return;
      }
    }

    letter.isFavorite = !letter.isFavorite;
    this.commit(state);
  }

  public consumeMiniModeEnergy(): boolean {
    const state = this.store.getState();
    if (!state.config.features.matchMiniModeEnabled) {
      this.toast(state, 'Mini mode is disabled by config');
      this.commit(state);
      return false;
    }
    if (state.energy.current < state.config.energy.miniModeEntryCost) {
      this.toast(state, 'Not enough energy');
      this.commit(state);
      return false;
    }
    state.energy.current -= state.config.energy.miniModeEntryCost;
    this.commit(state);
    return true;
  }

  public rerollOrder(slotIndex: number): boolean {
    const state = this.store.getState();
    if (!state.ordersActive[slotIndex]) {
      return false;
    }

    const dayKey = toDayKey(state.now);
    if (state.reroll.dayKey !== dayKey) {
      state.reroll.dayKey = dayKey;
      state.reroll.freeUsed = false;
      state.reroll.gemCost = 10;
    }

    if (!state.reroll.freeUsed) {
      state.reroll.freeUsed = true;
    } else {
      if (state.player.gems < state.reroll.gemCost) {
        this.toast(state, 'Not enough gems');
        this.commit(state);
        return false;
      }
      state.player.gems -= state.reroll.gemCost;
      state.reroll.gemCost = clamp(state.reroll.gemCost + 5, 10, 50);
    }

    this.replaceOrderAt(state, slotIndex, slotIndex === 0 && state.player.level < 10);
    this.recordAction(state, 'use_reroll');
    this.toast(state, 'Order rerolled');
    this.commit(state);
    return true;
  }

  public tryCompleteOrder(slotIndex: number): boolean {
    const state = this.store.getState();
    const order = state.ordersActive[slotIndex];
    if (!order) {
      return false;
    }
    const definition = this.content.getOrder(order.definitionId);

    const consumed = this.collectItemsForRequirements(state, definition.requirements);
    if (!consumed) {
      this.toast(state, 'Missing required items');
      this.commit(state);
      return false;
    }

    for (const itemId of consumed) {
      this.deleteItem(state, itemId);
    }

    state.player.coins += definition.rewards.coins;
    state.player.stars += definition.rewards.stars;
    this.grantXp(state, definition.rewards.xp);

    this.analytics.track('order_completed', {
      orderId: definition.id,
      orderType: definition.type,
    });

    this.incrementTask(state, 'order_completed', 1);
    this.recordAction(state, 'complete_first_order');

    if (definition.triggerLetterId) {
      this.addLetterById(state, definition.triggerLetterId);
    }

    if (definition.triggerBranchMomentId) {
      state.echo.pendingBranchMomentIds.push(definition.triggerBranchMomentId);
    }

    this.replaceOrderAt(state, slotIndex, slotIndex === 0 && state.player.level < 10);
    this.fillQueue(state);

    this.toast(
      state,
      `Order complete +${definition.rewards.coins}c +${definition.rewards.stars}⭐`,
    );
    this.commit(state);
    return true;
  }

  public chooseEchoOption(option: 'A' | 'B', forcedAuto = false): boolean {
    const state = this.store.getState();
    const choice = state.echo.choiceState;
    if (!choice) {
      return false;
    }

    const echoItem = state.items[choice.echoItemId];
    const branch = this.content.getBranchMoment(choice.branchMomentId);
    const picked = option === 'A' ? branch.optionA : branch.optionB;

    if (echoItem) {
      this.deleteItem(state, echoItem.uid);
    }

    state.echo.choiceState = undefined;
    state.ui.showDecorModal = false;

    const starsReward = 30 * 3;
    state.player.stars += starsReward;
    state.decor.flags[picked.decorFlag] = true;
    state.decor.currentRoomId = branch.roomId;
    state.decor.newRoomEnteredAt = state.now;
    state.ui.overlayFadeUntil = state.now + 1200;

    const room = this.content.getRoom(branch.roomId);
    const styleId = room.styles.find((style) => style.id === picked.id)?.id ?? room.styles[0]?.id;
    if (styleId) {
      state.decor.roomStyles[branch.roomId] = styleId;
    }

    this.addLetterById(state, picked.letterId);

    if (forcedAuto) {
      localStorage.setItem('echo_choice_sync_stub', JSON.stringify({ branch: branch.id, auto: true }));
    } else {
      localStorage.setItem(
        'echo_choice_sync_stub',
        JSON.stringify({ branch: branch.id, option: option === 'A' ? 'A' : 'B' }),
      );
    }

    this.analytics.track('echo_choice_made', {
      branchId: branch.id,
      option,
      forcedAuto,
    });
    this.recordAction(state, 'resolve_echo_choice');
    this.toast(state, `${picked.title}: +${starsReward}⭐ + exclusive letter`);
    this.commit(state);
    return true;
  }

  public convertEchoToCoins(itemId: string): boolean {
    const state = this.store.getState();
    const item = state.items[itemId];
    if (!item || !item.isEcho) {
      return false;
    }

    const reward = Math.floor((SELL_VALUES_BY_TIER[item.tier] ?? 1) * 0.5);
    state.player.coins += reward;
    this.deleteItem(state, itemId);
    this.toast(state, `Echo converted +${reward} coins`);
    this.commit(state);
    return true;
  }

  public forceEchoOnRandomEligible(): boolean {
    const state = this.store.getState();
    const candidate = Object.values(state.items).find(
      (item) => !item.isEcho && item.tier >= 5 && item.tier <= 7,
    );
    if (!candidate) {
      return false;
    }
    return this.triggerEchoFromItem(state, candidate.itemId);
  }

  public debugGiveResources(coins: number, stars: number, energy: number): void {
    const state = this.store.getState();
    state.player.coins += coins;
    state.player.stars += stars;
    state.energy.current = clamp(state.energy.current + energy, 0, state.energy.max);
    this.toast(state, `Debug +${coins}c +${stars}⭐ +${energy}⚡`);
    this.commit(state);
  }

  public debugSpawnItem(itemId: string): boolean {
    const state = this.store.getState();
    const boardSlot = this.findFirstEmptyBoardSlot(state);
    const inventorySlot = this.findFirstEmptyInventorySlot(state);
    if (boardSlot == null && inventorySlot == null) {
      return false;
    }
    this.spawnItem(
      state,
      itemId,
      boardSlot != null ? 'board' : 'inventory',
      boardSlot ?? (inventorySlot as number),
      { isEcho: false },
    );
    this.commit(state);
    return true;
  }

  public debugClearBoard(): void {
    const state = this.store.getState();
    for (let i = 0; i < state.boardSlots.length; i += 1) {
      const id = state.boardSlots[i];
      if (id) {
        delete state.items[id];
      }
      state.boardSlots[i] = null;
    }
    state.echo.activeEchoIds = state.echo.activeEchoIds.filter((id) => state.items[id]);
    this.commit(state);
  }

  public autoMergeByDoubleTap(itemId: string): boolean {
    const state = this.store.getState();
    if (state.echo.choiceState) {
      return false;
    }

    const now = state.now;
    const blockedUntil = this.doubleTapCooldownByItem.get(itemId) ?? 0;
    if (blockedUntil > now) {
      return false;
    }

    let mergedAny = false;
    let continueMerging = true;
    while (continueMerging) {
      continueMerging = false;
      const groups = this.groupMergeableByItemId(state, 'board');
      const group = groups.get(itemId);
      if (!group || group.length < 2) {
        break;
      }
      const merged = this.mergeItems(state, group[0], group[1], 'board', state.items[group[0]].slotIndex);
      if (merged) {
        mergedAny = true;
        continueMerging = true;
        this.resolveChainReaction(state, 'board');
      }
    }

    if (mergedAny) {
      this.doubleTapCooldownByItem.set(itemId, now + 2000);
      this.commit(state);
    }
    return mergedAny;
  }

  public openChoiceFromPendingEcho(): boolean {
    const state = this.store.getState();
    const echoItem = Object.values(state.items).find((item) => item.isEcho);
    if (!echoItem) {
      return false;
    }
    const opened = this.openEchoChoiceForItem(state, echoItem.uid);
    if (opened) {
      this.commit(state);
      return true;
    }
    return false;
  }

  public claimDailyBonusChest(): boolean {
    const state = this.store.getState();
    if (state.liveOps.bonusChestClaimed) {
      return false;
    }
    const allComplete = state.liveOps.dailyTasks.every((task) => task.complete);
    if (!allComplete) {
      return false;
    }
    state.liveOps.bonusChestClaimed = true;
    state.player.coins += 200;
    state.player.stars += 40;
    this.recordAction(state, 'collect_daily_task_bonus');
    this.toast(state, 'Daily chest claimed +200c +40⭐');
    this.commit(state);
    return true;
  }

  public claimLoginReward(): boolean {
    const state = this.store.getState();
    if (state.liveOps.loginClaimedToday) {
      return false;
    }
    state.liveOps.loginClaimedToday = true;
    const reward = state.liveOps.loginStreak * 10;
    state.player.stars += reward;
    this.toast(state, `Login reward +${reward}⭐`);
    this.commit(state);
    return true;
  }

  public setCurrentRoom(roomId: string): void {
    const state = this.store.getState();
    const room = this.content.rooms.find((entry) => entry.id === roomId);
    if (!room) {
      return;
    }
    if (room.unlockedAtEpisode > state.player.episode) {
      this.toast(state, 'Room locked by episode progress');
      this.commit(state);
      return;
    }
    state.decor.currentRoomId = roomId;
    state.decor.newRoomEnteredAt = state.now;
    state.ui.overlayFadeUntil = state.now + 800;
    this.commit(state);
  }

  public getOrderDefinitionsForActive(): OrderDefinition[] {
    const state = this.store.getState();
    return state.ordersActive.map((instance) => this.content.getOrder(instance.definitionId));
  }

  public getAnalyticsEvents() {
    return this.analytics.getEvents();
  }

  public getGeneratorState(generatorId: string) {
    return this.store.getState().generators[generatorId];
  }

  private restoreChoiceOnResume(): void {
    const state = this.store.getState();
    const choice = state.echo.choiceState;
    if (!choice) {
      return;
    }

    if (state.now - choice.openedAt > 24 * 3600 * 1000) {
      this.chooseEchoOption('A', true);
      return;
    }

    state.ui.showDecorModal = true;
    this.commit(state);
  }

  private stateFromSave(save: SaveData): GameState {
    const config = save.remote_config_cache;
    const now = Date.now();

    const state: GameState = {
      config,
      seed: save.seed,
      now,
      boardWidth: save.board_state.width,
      boardHeight: save.board_state.height,
      items: {},
      boardSlots: Array.from({ length: SLOT_COUNT }, () => null),
      inventorySlots: Array.from({ length: save.inventory_state.capacity }, () => null),
      inventoryCapacity: save.inventory_state.capacity,
      generators: Object.fromEntries(save.generator_states.map((entry) => [entry.id, { ...entry }])),
      energy: { ...save.energy_state },
      player: { ...save.player_progress },
      decor: {
        ...save.decor_choices,
        roomStyles: { ...save.decor_choices.roomStyles },
        flags: { ...save.decor_choices.flags },
      },
      letters: save.letter_inbox.map((entry) => ({ ...entry })),
      echo: {
        ...save.echo_queue,
        activeEchoIds: [...save.echo_queue.activeEchoIds],
        pendingEchoItemIds: [...save.echo_queue.pendingEchoItemIds],
        pendingBranchMomentIds: [...(save.echo_queue.pendingBranchMomentIds ?? [])],
        choiceState: save.echo_queue.choiceState ? { ...save.echo_queue.choiceState } : undefined,
      },
      ordersActive: save.order_state.active.map((entry) => ({ ...entry })),
      ordersQueued: save.order_state.queued.map((entry) => ({ ...entry })),
      reroll: { ...save.order_state.reroll },
      liveOps: {
        ...save.event_progress,
        dailyTasks: save.event_progress.dailyTasks.map((entry) => ({ ...entry })),
      },
      purchaseHistory: [...save.purchase_history],
      episodeCompletedSteps: [...save.episode_progress.completedStepIds],
      episodeActiveStepId: save.episode_progress.activeEpisodeStepId,
      pendingInboxNotice: undefined,
      ui: {
        showSettings: false,
        showDebug: false,
        showInbox: false,
        selectedLetterId: undefined,
        showInventoryModal: false,
        showDecorModal: Boolean(save.echo_queue.choiceState),
        showOrderModal: false,
        showTooltipForItemId: undefined,
        tooltipPosition: undefined,
        toasts: [],
        overlayFadeUntil: 0,
        paused: false,
        inventoryPage: 0,
        soundEnabled: true,
        musicEnabled: true,
      },
    };

    for (const item of [...save.board_state.items, ...save.inventory_state.items]) {
      state.items[item.uid] = { ...item };
      if (item.container === 'board' && item.slotIndex < state.boardSlots.length) {
        state.boardSlots[item.slotIndex] = item.uid;
      }
      if (item.container === 'inventory' && item.slotIndex < state.inventorySlots.length) {
        state.inventorySlots[item.slotIndex] = item.uid;
      }
    }

    this.fillQueue(state);
    return state;
  }

  private createDefaultState(config: RemoteConfig): GameState {
    const now = Date.now();
    const seed = now % 2147483647;
    const state: GameState = {
      config,
      seed,
      now,
      boardWidth: BOARD_COLS,
      boardHeight: BOARD_ROWS,
      items: {},
      boardSlots: Array.from({ length: SLOT_COUNT }, () => null),
      inventorySlots: Array.from({ length: config.inventory.baseSlots }, () => null),
      inventoryCapacity: config.inventory.baseSlots,
      generators: {
        toolbox: { id: 'toolbox', level: 1, cooldownEndAt: 0 },
        pantry: { id: 'pantry', level: 1, cooldownEndAt: 0 },
      },
      energy: {
        current: config.energy.max,
        max: config.energy.max,
        lastTickAt: now,
        rvLastWatchAt: 0,
        rvWatchesToday: 0,
        rvDayKey: toDayKey(now),
      },
      player: {
        level: 1,
        xp: 0,
        xpToNext: 100,
        coins: 200,
        stars: 0,
        gems: 30,
        episode: 1,
        onboardingFlags: {},
      },
      decor: {
        roomStyles: {
          entrance_hall: 'classic_welcome',
          kitchen: 'kitchen_modern',
          sunroom_garden: 'sunroom_botanical',
          library_study: 'library_oak',
        },
        flags: {},
        currentRoomId: 'entrance_hall',
        newRoomEnteredAt: now,
      },
      letters: [],
      echo: {
        eligibleMergeMissCount: 0,
        consecutiveMergeCount: 0,
        activeEchoIds: [],
        pendingEchoItemIds: [],
        pendingBranchMomentIds: [],
        choiceState: undefined,
      },
      ordersActive: [],
      ordersQueued: [],
      reroll: {
        dayKey: toDayKey(now),
        freeUsed: false,
        gemCost: 10,
      },
      liveOps: {
        dailyTaskDayKey: toDayKey(now),
        dailyTasks: this.createDailyTasks(),
        bonusChestClaimed: false,
        loginDayKey: toDayKey(now),
        loginStreak: 1,
        loginClaimedToday: false,
        weeklyEventWeekKey: toWeekKey(now),
        weeklyEventPoints: 0,
      },
      purchaseHistory: [],
      episodeCompletedSteps: [],
      episodeActiveStepId: this.content.episodes[0]?.steps[0]?.id,
      pendingInboxNotice: undefined,
      ui: {
        showSettings: false,
        showDebug: false,
        showInbox: false,
        selectedLetterId: undefined,
        showInventoryModal: false,
        showDecorModal: false,
        showOrderModal: false,
        showTooltipForItemId: undefined,
        tooltipPosition: undefined,
        toasts: [],
        overlayFadeUntil: 0,
        paused: false,
        inventoryPage: 0,
        soundEnabled: true,
        musicEnabled: true,
      },
    };

    this.seedInitialOrders(state);
    return state;
  }

  private commit(next: GameState): void {
    this.store.setState(next);
  }

  private toast(state: GameState, text: string): void {
    state.ui.toasts.push({
      id: makeId('toast'),
      text,
      createdAt: state.now,
    });
  }

  private trimToasts(state: GameState, now: number): boolean {
    const before = state.ui.toasts.length;
    state.ui.toasts = state.ui.toasts.filter((entry) => now - entry.createdAt <= 2800);
    return before !== state.ui.toasts.length;
  }

  private ensureDailyResets(state: GameState): boolean {
    let dirty = false;
    const dayKey = toDayKey(state.now);

    if (state.reroll.dayKey !== dayKey) {
      state.reroll.dayKey = dayKey;
      state.reroll.freeUsed = false;
      state.reroll.gemCost = 10;
      dirty = true;
    }

    if (state.energy.rvDayKey !== dayKey) {
      state.energy.rvDayKey = dayKey;
      state.energy.rvWatchesToday = 0;
      dirty = true;
    }

    if (state.liveOps.dailyTaskDayKey !== dayKey) {
      state.liveOps.dailyTaskDayKey = dayKey;
      state.liveOps.dailyTasks = this.createDailyTasks();
      state.liveOps.bonusChestClaimed = false;
      dirty = true;
    }

    if (state.liveOps.loginDayKey !== dayKey) {
      const previousDate = new Date(state.liveOps.loginDayKey);
      const currentDate = new Date(dayKey);
      const diffDays = Math.floor(
        (currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (diffDays === 1) {
        state.liveOps.loginStreak = clamp(state.liveOps.loginStreak + 1, 1, 7);
      } else {
        state.liveOps.loginStreak = 1;
      }

      state.liveOps.loginDayKey = dayKey;
      state.liveOps.loginClaimedToday = false;
      dirty = true;
    }

    const weekKey = toWeekKey(state.now);
    if (state.liveOps.weeklyEventWeekKey !== weekKey) {
      state.liveOps.weeklyEventWeekKey = weekKey;
      state.liveOps.weeklyEventPoints = 0;
      dirty = true;
    }

    return dirty;
  }

  private tickEnergyRegen(state: GameState, now: number): boolean {
    if (state.energy.current >= state.energy.max) {
      state.energy.lastTickAt = now;
      return false;
    }

    const elapsed = now - state.energy.lastTickAt;
    const step = state.config.energy.regenSeconds * 1000;
    const gained = Math.floor(elapsed / step);
    if (gained <= 0) {
      return false;
    }

    state.energy.current = clamp(state.energy.current + gained, 0, state.energy.max);
    state.energy.lastTickAt += gained * step;
    return true;
  }

  private applyOfflineRegen(): void {
    const state = this.store.getState();
    const now = Date.now();
    const elapsed = now - state.energy.lastTickAt;
    if (elapsed <= 0) {
      state.now = now;
      this.commit(state);
      return;
    }

    const step = state.config.energy.regenSeconds * 1000;
    const gained = Math.floor(elapsed / step);
    const capped = clamp(gained, 0, state.config.energy.offlineRegenCap);
    if (capped > 0) {
      state.energy.current = clamp(state.energy.current + capped, 0, state.energy.max);
      this.toast(state, `Offline regen +${capped} energy`);
    }
    state.energy.lastTickAt = now;
    state.now = now;
    this.commit(state);
  }

  private tickOrderExpiryAndForcing(state: GameState, now: number): boolean {
    let dirty = false;
    for (let index = 0; index < state.ordersActive.length; index += 1) {
      const order = state.ordersActive[index];
      if (!order) {
        continue;
      }

      if (order.expiresAt && now >= order.expiresAt) {
        this.replaceOrderAt(state, index, index === 0 && state.player.level < 10);
        this.toast(state, 'Timed order expired and rerolled');
        dirty = true;
        continue;
      }

      if (now - order.forcedAt >= 24 * 60 * 60 * 1000) {
        this.replaceOrderAt(state, index, index === 0 && state.player.level < 10);
        this.toast(state, 'Order auto-rerolled after 24h');
        dirty = true;
      }
    }

    if (dirty) {
      this.fillQueue(state);
    }
    return dirty;
  }

  private tickInventoryExpiry(state: GameState, now: number): boolean {
    let dirty = false;
    for (const item of Object.values(state.items)) {
      if (item.container !== 'inventory') {
        continue;
      }
      if (!item.inventoryExpiresAt) {
        continue;
      }
      if (now >= item.inventoryExpiresAt) {
        const sell = Math.floor((SELL_VALUES_BY_TIER[item.tier] ?? 1) * 0.5);
        state.player.coins += sell;
        this.deleteItem(state, item.uid);
        this.toast(state, `Expired inventory item converted +${sell} coins`);
        dirty = true;
      }
    }
    return dirty;
  }

  private tickEchoWarningsAndExpiry(state: GameState, now: number): boolean {
    let dirty = false;

    const activeIds = [...state.echo.activeEchoIds];
    for (const itemId of activeIds) {
      const item = state.items[itemId];
      if (!item || !item.isEcho) {
        state.echo.activeEchoIds = state.echo.activeEchoIds.filter((id) => id !== itemId);
        dirty = true;
        continue;
      }

      const expiresAt = item.echoExpiresAt ?? 0;
      const timeLeft = expiresAt - now;
      if (timeLeft <= 0) {
        item.isEcho = false;
        item.echoExpiresAt = undefined;
        item.echoWarningStage = undefined;
        state.echo.activeEchoIds = state.echo.activeEchoIds.filter((id) => id !== itemId);
        this.toast(state, 'Time Echo expired and became normal');
        dirty = true;
        continue;
      }

      const previous = item.echoWarningStage;
      if (timeLeft <= 10 * 60 * 1000) {
        item.echoWarningStage = '10m';
      } else if (timeLeft <= 60 * 60 * 1000) {
        item.echoWarningStage = '1h';
      } else if (timeLeft <= 6 * 60 * 60 * 1000) {
        item.echoWarningStage = '6h';
      } else {
        item.echoWarningStage = undefined;
      }

      if (previous !== item.echoWarningStage && item.echoWarningStage) {
        this.toast(state, `Echo warning: ${item.echoWarningStage} left`);
        dirty = true;
      }
    }

    return dirty;
  }

  private tickPendingEchoQueue(state: GameState): boolean {
    let dirty = false;
    if (state.echo.pendingEchoItemIds.length === 0) {
      return false;
    }

    while (
      state.echo.pendingEchoItemIds.length > 0 &&
      state.echo.activeEchoIds.length < state.config.echo.maxActiveEchoes
    ) {
      const emptyBoard = this.findFirstEmptyBoardSlot(state);
      const emptyInventory = this.findFirstEmptyInventorySlot(state);
      if (emptyBoard == null && emptyInventory == null) {
        break;
      }

      const itemId = state.echo.pendingEchoItemIds.shift();
      if (!itemId) {
        break;
      }

      this.spawnItem(
        state,
        itemId,
        emptyBoard != null ? 'board' : 'inventory',
        emptyBoard ?? (emptyInventory as number),
        {
          isEcho: true,
          echoExpiresAt: state.now + state.config.echo.echoLifetimeHours * 3600 * 1000,
        },
      );
      dirty = true;
    }

    return dirty;
  }

  private tickEchoChoiceGrace(state: GameState, now: number): boolean {
    const choice = state.echo.choiceState;
    if (!choice) {
      return false;
    }

    const item = state.items[choice.echoItemId];
    if (!item) {
      state.echo.choiceState = undefined;
      state.ui.showDecorModal = false;
      return true;
    }

    const expiresAt = item.echoExpiresAt ?? 0;
    if (now > expiresAt && !choice.graceDeadlineAt) {
      choice.graceDeadlineAt = now + state.config.echo.choiceGraceSeconds * 1000;
      this.toast(state, 'Echo choice grace period started');
      return true;
    }

    if (choice.graceDeadlineAt && now >= choice.graceDeadlineAt) {
      this.chooseEchoOption('A', true);
      return true;
    }

    return false;
  }

  private syncEchoIdList(): void {
    const state = this.store.getState();
    state.echo.activeEchoIds = state.echo.activeEchoIds.filter((id) => state.items[id]?.isEcho);
    this.commit(state);
  }

  private resolveDropTarget(
    state: GameState,
    x: number,
    y: number,
  ): { container: ContainerType; slot: number } | null {
    const boardSlot = pointToBoardSlot(x, y);
    if (boardSlot != null) {
      return { container: 'board', slot: boardSlot };
    }

    const inventorySlot = pointToInventorySlot(
      x,
      y,
      state.inventoryCapacity,
      state.ui.inventoryPage,
    );
    if (inventorySlot != null) {
      return { container: 'inventory', slot: inventorySlot };
    }

    const nearestBoard = this.findNearestBoardSlot(x, y);
    if (nearestBoard != null) {
      return { container: 'board', slot: nearestBoard };
    }

    const nearestInventory = this.findNearestInventorySlot(state, x, y);
    if (nearestInventory != null) {
      return { container: 'inventory', slot: nearestInventory };
    }

    return null;
  }

  private findNearestBoardSlot(x: number, y: number): number | null {
    let bestSlot: number | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const center = rectCenter(boardSlotToRect(i));
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlot = i;
      }
    }
    if (bestDistance <= SNAP_DISTANCE) {
      return bestSlot;
    }
    return null;
  }

  private findNearestInventorySlot(state: GameState, x: number, y: number): number | null {
    const start = state.ui.inventoryPage * 15;
    const end = Math.min(state.inventoryCapacity, start + 15);
    let bestSlot: number | null = null;
    let bestDistance = Infinity;
    for (let globalSlot = start; globalSlot < end; globalSlot += 1) {
      const local = inventoryGlobalToVisible(globalSlot, state.ui.inventoryPage);
      if (local == null) {
        continue;
      }
      const center = rectCenter(inventorySlotToRect(local));
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlot = globalSlot;
      }
    }
    if (bestDistance <= SNAP_DISTANCE) {
      return bestSlot;
    }
    return null;
  }

  private canItemsMerge(a: ItemInstance, b: ItemInstance): boolean {
    return !a.isEcho && !b.isEcho && a.itemId === b.itemId && a.tier < 8 && b.tier < 8;
  }

  private mergeItems(
    state: GameState,
    itemAId: string,
    itemBId: string,
    targetContainer: ContainerType,
    targetSlot: number,
  ): boolean {
    const itemA = state.items[itemAId];
    const itemB = state.items[itemBId];
    if (!itemA || !itemB) {
      return false;
    }
    if (!this.canItemsMerge(itemA, itemB)) {
      return false;
    }

    const nextId = this.content.getNextTierItem(itemA.itemId);
    if (!nextId) {
      this.toast(state, this.localization.t('ui.max'));
      return false;
    }

    this.deleteItem(state, itemAId);
    this.deleteItem(state, itemBId);

    const merged = this.spawnItem(state, nextId, targetContainer, targetSlot, {
      sourceGeneratorId: itemA.sourceGeneratorId ?? itemB.sourceGeneratorId,
      isEcho: false,
    });

    this.analytics.track('merge_completed', {
      fromItem: itemA.itemId,
      toItem: nextId,
      tier: merged.tier,
    });
    this.incrementTask(state, 'merge_completed', 1);

    const mergeGap = state.now - this.lastMergeAt;
    if (mergeGap > MERGE_STREAK_RESET_MS) {
      state.echo.consecutiveMergeCount = 1;
    } else {
      state.echo.consecutiveMergeCount += 1;
    }
    this.lastMergeAt = state.now;

    this.recordAction(state, 'first_merge');
    if (merged.tier >= 5 && merged.tier <= 7) {
      this.tryEchoRollFromMergedItem(state, merged);
    }

    this.toast(state, `${this.getItemDisplayName(merged.itemId)} merged`);
    return true;
  }

  private resolveChainReaction(state: GameState, container: ContainerType): void {
    let mergedInLoop = true;
    while (mergedInLoop) {
      mergedInLoop = false;
      const groups = this.groupMergeableByTierDesc(state, container);
      for (const group of groups) {
        const ids = group.ids;
        while (ids.length >= 2) {
          const first = ids.shift();
          const second = ids.shift();
          if (!first || !second) {
            continue;
          }
          const firstItem = state.items[first];
          if (!firstItem) {
            continue;
          }
          const merged = this.mergeItems(
            state,
            first,
            second,
            firstItem.container,
            firstItem.slotIndex,
          );
          if (merged) {
            mergedInLoop = true;
            break;
          }
        }
        if (mergedInLoop) {
          break;
        }
      }
    }
  }

  private groupMergeableByTierDesc(state: GameState, container: ContainerType): Array<{ tier: number; ids: string[] }> {
    const byItem = this.groupMergeableByItemId(state, container);
    const groups: Array<{ tier: number; ids: string[] }> = [];
    for (const [itemId, ids] of byItem) {
      if (ids.length < 2) {
        continue;
      }
      const tier = this.content.getItem(itemId).tier;
      groups.push({ tier, ids: [...ids] });
    }
    groups.sort((a, b) => b.tier - a.tier);
    return groups;
  }

  private groupMergeableByItemId(state: GameState, container: ContainerType): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const item of Object.values(state.items)) {
      if (item.container !== container || item.isEcho || item.tier >= 8) {
        continue;
      }
      const arr = map.get(item.itemId) ?? [];
      arr.push(item.uid);
      map.set(item.itemId, arr);
    }
    return map;
  }

  private moveItemTo(state: GameState, itemId: string, container: ContainerType, slot: number): void {
    const item = state.items[itemId];
    if (!item) {
      return;
    }

    if (item.container === 'board') {
      state.boardSlots[item.slotIndex] = null;
    } else {
      state.inventorySlots[item.slotIndex] = null;
    }

    if (container === 'board') {
      state.boardSlots[slot] = item.uid;
      item.inventoryExpiresAt = undefined;
    } else {
      state.inventorySlots[slot] = item.uid;
      item.inventoryExpiresAt = state.now + state.config.inventory.expiryHours * 3600 * 1000;
    }

    item.container = container;
    item.slotIndex = slot;
  }

  private swapItems(state: GameState, itemAId: string, itemBId: string): void {
    const itemA = state.items[itemAId];
    const itemB = state.items[itemBId];
    if (!itemA || !itemB) {
      return;
    }

    const aContainer = itemA.container;
    const aSlot = itemA.slotIndex;
    const bContainer = itemB.container;
    const bSlot = itemB.slotIndex;

    this.moveItemTo(state, itemAId, bContainer, bSlot);
    this.moveItemTo(state, itemBId, aContainer, aSlot);
  }

  private deleteItem(state: GameState, itemId: string): void {
    const item = state.items[itemId];
    if (!item) {
      return;
    }
    if (item.container === 'board') {
      state.boardSlots[item.slotIndex] = null;
    } else {
      state.inventorySlots[item.slotIndex] = null;
    }
    delete state.items[itemId];
    if (item.isEcho) {
      state.echo.activeEchoIds = state.echo.activeEchoIds.filter((id) => id !== itemId);
    }
  }

  private spawnItem(
    state: GameState,
    itemId: string,
    container: ContainerType,
    slot: number,
    options: {
      sourceGeneratorId?: string;
      isEcho: boolean;
      echoExpiresAt?: number;
    },
  ): ItemInstance {
    const data = this.content.getItem(itemId);
    const chain = this.content.getChainByItem(itemId);

    const instance: ItemInstance = {
      uid: makeId('item'),
      itemId,
      chainId: chain.id,
      tier: data.tier,
      container,
      slotIndex: slot,
      createdAt: state.now,
      sourceGeneratorId: options.sourceGeneratorId,
      isEcho: options.isEcho,
      echoExpiresAt: options.echoExpiresAt,
      echoWarningStage: undefined,
      inventoryExpiresAt:
        container === 'inventory'
          ? state.now + state.config.inventory.expiryHours * 3600 * 1000
          : undefined,
    };

    state.items[instance.uid] = instance;
    if (container === 'board') {
      state.boardSlots[slot] = instance.uid;
    } else {
      state.inventorySlots[slot] = instance.uid;
    }

    if (instance.isEcho) {
      state.echo.activeEchoIds.push(instance.uid);
    }

    return instance;
  }

  private findFirstEmptyBoardSlot(state: GameState): number | null {
    const index = state.boardSlots.findIndex((slot) => slot == null);
    return index >= 0 ? index : null;
  }

  private findFirstEmptyInventorySlot(state: GameState): number | null {
    const index = state.inventorySlots.findIndex((slot) => slot == null);
    return index >= 0 ? index : null;
  }

  private tryScrapItem(state: GameState, itemId: string): boolean {
    const item = state.items[itemId];
    if (!item) {
      return false;
    }
    if (item.tier >= 5) {
      const ok = window.confirm(`Sell ${this.getItemDisplayName(item.itemId)} (Tier ${item.tier})?`);
      if (!ok) {
        return false;
      }
    }

    const sell = SELL_VALUES_BY_TIER[item.tier] ?? 1;
    state.player.coins += sell;
    this.deleteItem(state, itemId);
    this.toast(state, `+${sell} coins`);
    return true;
  }

  private tryEchoRollFromMergedItem(state: GameState, mergedItem: ItemInstance): void {
    const eligible =
      mergedItem.tier >= 5 &&
      mergedItem.tier <= 7 &&
      !mergedItem.isEcho &&
      state.player.level >= 5 &&
      state.echo.activeEchoIds.length < state.config.echo.maxActiveEchoes;

    if (!eligible) {
      return;
    }

    let chance =
      state.player.level <= state.config.echo.earlyGameLevelCap
        ? state.config.echo.earlyGameChance
        : state.config.echo.baseChance;

    if (state.now - state.decor.newRoomEnteredAt <= 10 * 60 * 1000) {
      chance += state.config.echo.newRoomBoost;
    }

    const streakBonus = Math.min(
      Math.floor(state.echo.consecutiveMergeCount / 5) * state.config.echo.streakPerFiveMerges,
      state.config.echo.streakMaxBonus,
    );
    chance += streakBonus;

    if (state.config.features.eventBoostEnabled) {
      chance += state.config.echo.eventBoost;
    }
    if (state.config.features.vipBonusEnabled) {
      chance += state.config.echo.vipBoost;
    }

    const pity = state.echo.eligibleMergeMissCount >= state.config.echo.pityThreshold;
    const rollSuccess = pity || this.rng.next() <= chance;

    if (!rollSuccess) {
      state.echo.eligibleMergeMissCount += 1;
      return;
    }

    state.echo.eligibleMergeMissCount = 0;
    const triggered = this.triggerEchoFromItem(state, mergedItem.itemId);
    if (triggered) {
      this.analytics.track('echo_triggered', {
        baseItem: mergedItem.itemId,
        tier: mergedItem.tier,
        chance,
        pity,
      });
      this.recordAction(state, 'trigger_first_echo');
    }
  }

  private triggerEchoFromItem(state: GameState, itemId: string): boolean {
    if (state.echo.activeEchoIds.length >= state.config.echo.maxActiveEchoes) {
      return false;
    }

    const boardSlot = this.findFirstEmptyBoardSlot(state);
    const inventorySlot = this.findFirstEmptyInventorySlot(state);
    const expires = state.now + state.config.echo.echoLifetimeHours * 3600 * 1000;

    if (boardSlot != null) {
      this.spawnItem(state, itemId, 'board', boardSlot, {
        isEcho: true,
        echoExpiresAt: expires,
      });
      this.toast(state, 'Time Echo emerged!');
      return true;
    }

    if (inventorySlot != null) {
      this.spawnItem(state, itemId, 'inventory', inventorySlot, {
        isEcho: true,
        echoExpiresAt: expires,
      });
      this.toast(state, 'Time Echo stored in inventory');
      return true;
    }

    if (state.echo.pendingEchoItemIds.length < state.config.echo.pendingQueueMax) {
      state.echo.pendingEchoItemIds.push(itemId);
      this.toast(state, 'Time Echo queued (no space)');
      return true;
    }

    state.pendingInboxNotice = 'Echo fallback notice: no room for additional echoes.';
    this.toast(state, state.pendingInboxNotice);
    return false;
  }

  private openEchoChoiceForItem(state: GameState, itemId: string): boolean {
    const item = state.items[itemId];
    if (!item || !item.isEcho) {
      return false;
    }

    const branchId =
      state.echo.pendingBranchMomentIds.shift() ?? this.content.branchMoments[0]?.id ?? 'kitchen_modern_vintage';

    state.echo.choiceState = {
      echoItemId: itemId,
      branchMomentId: branchId,
      openedAt: state.now,
    };
    state.ui.showDecorModal = true;
    return true;
  }

  private tryCompleteOrderByDraggedItem(state: GameState, itemId: string): boolean {
    const item = state.items[itemId];
    if (!item) {
      return false;
    }

    for (let i = 0; i < state.ordersActive.length; i += 1) {
      const order = state.ordersActive[i];
      const definition = this.content.getOrder(order.definitionId);
      const requiresItem = definition.requirements.some(
        (req) => req.chainId === item.chainId && item.tier >= req.tier,
      );
      if (!requiresItem) {
        continue;
      }
      return this.tryCompleteOrder(i);
    }
    return false;
  }

  private collectItemsForRequirements(
    state: GameState,
    requirements: OrderRequirement[],
  ): string[] | null {
    const candidates = Object.values(state.items)
      .filter((item) => !item.isEcho)
      .sort((a, b) => {
        if (a.tier !== b.tier) {
          return a.tier - b.tier;
        }
        return a.container === 'board' ? -1 : 1;
      });

    const reserved = new Set<string>();

    for (const requirement of requirements) {
      let matched = 0;
      for (const item of candidates) {
        if (reserved.has(item.uid)) {
          continue;
        }
        if (item.chainId !== requirement.chainId) {
          continue;
        }
        if (item.tier < requirement.tier) {
          continue;
        }
        reserved.add(item.uid);
        matched += 1;
        if (matched >= requirement.count) {
          break;
        }
      }
      if (matched < requirement.count) {
        return null;
      }
    }

    return [...reserved];
  }

  private grantXp(state: GameState, amount: number): void {
    state.player.xp += amount;
    while (state.player.xp >= state.player.xpToNext) {
      state.player.xp -= state.player.xpToNext;
      state.player.level += 1;
      state.player.xpToNext = 100 + state.player.level * 20;
      this.toast(state, `Level up! ${state.player.level}`);
    }

    const episodeByLevel = state.player.level >= 6 ? 3 : state.player.level >= 3 ? 2 : 1;
    if (episodeByLevel > state.player.episode) {
      state.player.episode = episodeByLevel;
      const episodeDef = this.content.episodes.find((entry) => entry.id === episodeByLevel);
      if (episodeDef?.unlockRoomId) {
        this.toast(state, `${this.localization.t(this.content.getRoom(episodeDef.unlockRoomId).nameKey)} unlocked`);
      }
    }
  }

  private recordAction(state: GameState, action: string): void {
    const active = this.getActiveEpisodeStep();
    if (active && active.requiredAction === action && !state.episodeCompletedSteps.includes(active.id)) {
      state.episodeCompletedSteps.push(active.id);
      state.episodeActiveStepId = this.findNextEpisodeStepId(state.episodeCompletedSteps);
    }

    if (action === 'first_merge') {
      this.incrementTask(state, 'merge_completed', 1);
      state.liveOps.weeklyEventPoints += 1;
    }
  }

  private getActiveEpisodeStep() {
    const state = this.store.getState();
    const stepId = state.episodeActiveStepId;
    if (!stepId) {
      return null;
    }
    for (const episode of this.content.episodes) {
      const step = episode.steps.find((entry) => entry.id === stepId);
      if (step) {
        return step;
      }
    }
    return null;
  }

  private findNextEpisodeStepId(completed: string[]): string | undefined {
    for (const episode of this.content.episodes) {
      for (const step of episode.steps) {
        if (!completed.includes(step.id)) {
          return step.id;
        }
      }
    }
    return undefined;
  }

  private createDailyTasks(): DailyTaskProgress[] {
    return TASK_TEMPLATES.map((template) => ({
      id: template.id,
      target: template.target,
      progress: 0,
      complete: false,
    }));
  }

  private incrementTask(state: GameState, taskId: string, amount: number): void {
    const task = state.liveOps.dailyTasks.find((entry) => entry.id === taskId);
    if (!task || task.complete) {
      return;
    }
    task.progress = clamp(task.progress + amount, 0, task.target);
    task.complete = task.progress >= task.target;
  }

  private seedInitialOrders(state: GameState): void {
    state.ordersActive = [
      this.makeOrderInstance(state, true),
      this.makeOrderInstance(state, false),
      this.makeOrderInstance(state, false),
    ];
    state.ordersQueued = [this.makeOrderInstance(state, false), this.makeOrderInstance(state, false)];
  }

  private fillQueue(state: GameState): void {
    while (state.ordersQueued.length < 2) {
      state.ordersQueued.push(this.makeOrderInstance(state, false));
    }
    while (state.ordersActive.length < 3) {
      const order = state.ordersQueued.shift() ?? this.makeOrderInstance(state, false);
      state.ordersActive.push(order);
    }
    state.ordersActive = state.ordersActive.slice(0, 3);
    state.ordersQueued = state.ordersQueued.slice(0, 2);
  }

  private replaceOrderAt(state: GameState, index: number, easySlot: boolean): void {
    const replacement = state.ordersQueued.shift() ?? this.makeOrderInstance(state, easySlot);
    state.ordersActive[index] = replacement;
    if (easySlot && state.player.level < 10) {
      const def = this.content.getOrder(replacement.definitionId);
      const hasHardRequirement = def.requirements.some((req) => req.tier > 3);
      if (hasHardRequirement) {
        state.ordersActive[index] = this.makeOrderInstance(state, true);
      }
    }
  }

  private makeOrderInstance(state: GameState, easyOnly: boolean): OrderInstance {
    const usedIds = new Set(
      [...state.ordersActive, ...state.ordersQueued]
        .map((entry) => entry.definitionId)
        .filter((id): id is string => Boolean(id)),
    );

    const candidates = this.content.orders.filter((order) => {
      if (order.minPlayerLevel > state.player.level || order.maxPlayerLevel < state.player.level) {
        return false;
      }
      if (easyOnly && order.requirements.some((req) => req.tier > 3)) {
        return false;
      }
      if (usedIds.has(order.id) && this.content.orders.length > 5) {
        return false;
      }
      return true;
    });

    const selected =
      candidates[this.rng.int(0, Math.max(0, candidates.length - 1))] ?? this.content.orders[0];

    const instance: OrderInstance = {
      instanceId: makeId('order'),
      definitionId: selected.id,
      type: selected.type,
      createdAt: state.now,
      forcedAt: state.now,
      expiresAt: selected.timedSeconds ? state.now + selected.timedSeconds * 1000 : undefined,
    };
    return instance;
  }

  private getItemDisplayName(itemId: string): string {
    const item = this.content.getItem(itemId);
    return this.localization.t(item.nameKey);
  }

  private addLetterById(state: GameState, letterId: string): void {
    const existing = state.letters.find((entry) => entry.id === letterId);
    if (existing) {
      return;
    }

    const def = this.content.getLetter(letterId);
    const roomName = this.localization.t(this.content.getRoom(state.decor.currentRoomId).nameKey);
    const selectedStyle = state.decor.roomStyles[state.decor.currentRoomId] ?? '';
    const body = this.localization.t(def.bodyKey, {
      player_name: PLAYER_NAME,
      room_name: roomName,
      decor_choice: selectedStyle,
      episode_number: state.player.episode,
    });
    state.letters.push({
      id: def.id,
      title: this.localization.t(def.titleKey),
      body,
      mood: def.mood,
      receivedAt: state.now,
      readAt: undefined,
      isFavorite: false,
    });
    this.toast(state, `New letter: ${this.localization.t(def.titleKey)}`);
  }

  public getCurrentBranchMoment(): BranchMomentDefinition | null {
    const state = this.store.getState();
    const choice = state.echo.choiceState;
    if (!choice) {
      return null;
    }
    return this.content.getBranchMoment(choice.branchMomentId);
  }

  public getInventoryItemWarningStage(item: ItemInstance): '24h' | '6h' | '1h' | null {
    const state = this.store.getState();
    if (item.container !== 'inventory' || !item.inventoryExpiresAt) {
      return null;
    }
    const remaining = item.inventoryExpiresAt - state.now;
    if (remaining <= 60 * 60 * 1000) {
      return '1h';
    }
    if (remaining <= 6 * 60 * 60 * 1000) {
      return '6h';
    }
    if (remaining <= 24 * 60 * 60 * 1000) {
      return '24h';
    }
    return null;
  }

  public expandInventoryBy(slots: number): boolean {
    const state = this.store.getState();
    if (slots <= 0) {
      return false;
    }
    const nextCapacity = clamp(
      state.inventoryCapacity + slots,
      state.config.inventory.baseSlots,
      state.config.inventory.maxSlots,
    );
    if (nextCapacity === state.inventoryCapacity) {
      return false;
    }
    const missing = nextCapacity - state.inventoryCapacity;
    for (let i = 0; i < missing; i += 1) {
      state.inventorySlots.push(null);
    }
    state.inventoryCapacity = nextCapacity;
    this.toast(state, `Inventory expanded to ${state.inventoryCapacity}`);
    this.commit(state);
    return true;
  }

  public dismissInboxNotice(): void {
    const state = this.store.getState();
    state.pendingInboxNotice = undefined;
    this.commit(state);
  }
}
