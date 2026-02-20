import { GameLoop } from '../engine/GameLoop';
import { Viewport } from '../engine/Viewport';
import { InputController, type PointerData } from '../engine/InputController';
import { CanvasRenderer } from '../engine/CanvasRenderer';
import { ContentRepository } from '../services/ContentRepository';
import { Localization } from '../services/Localization';
import { AnalyticsManager } from '../services/AnalyticsManager';
import { AdManager } from '../services/AdManager';
import { IAPManager } from '../services/IAPManager';
import { SaveService } from '../services/SaveService';
import { RemoteConfigService } from '../services/RemoteConfigService';
import { GameSimulation } from '../game/GameSimulation';
import { OverlayUI } from '../ui/OverlayUI';
import { easeOutCubic } from '../services/Time';
import { TRASH_RECT } from '../game/constants';
import { pointInRect } from '../game/Layout';

interface ActiveDrag {
  pointerId: number;
  itemUid: string;
  itemTypeId: string;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  hasDragged: boolean;
}

interface ReturnAnimation {
  itemUid: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startAt: number;
  durationMs: number;
}

export class GameApp {
  private shell: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private overlayLayer: HTMLDivElement;
  private tooltip: HTMLDivElement;

  private readonly content = new ContentRepository();
  private readonly localization = new Localization(this.content.localization);
  private readonly analytics = new AnalyticsManager();
  private readonly configService = new RemoteConfigService();
  private readonly saveService = new SaveService();
  private readonly adManager = new AdManager(() => Math.random());
  private readonly iapManager = new IAPManager(this.content.iapCatalog);
  private readonly simulation: GameSimulation;

  private readonly renderer: CanvasRenderer;
  private readonly viewport: Viewport;
  private readonly loop: GameLoop;
  private readonly input: InputController;
  private readonly ui: OverlayUI;

  private activeDrag: ActiveDrag | null = null;
  private returnAnimation: ReturnAnimation | null = null;
  private highlightTarget: { container: 'board' | 'inventory'; slot: number } | null = null;

  private holdTimer: number | null = null;
  private trashHoldTimer: number | null = null;
  private lastTap: { itemTypeId: string; at: number } | null = null;

  private lastAutoSaveAt = Date.now();
  private unbindSession: (() => void) | null = null;
  private unbindVisibility: (() => void) | null = null;
  private recoveredFromRuntimeError = false;

  constructor(private readonly root: HTMLElement) {
    this.shell = document.createElement('div');
    this.shell.className = 'game-shell';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';

    this.overlayLayer = document.createElement('div');
    this.overlayLayer.className = 'overlay-layer';

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip hidden';

    this.shell.append(this.canvas, this.overlayLayer, this.tooltip);
    this.root.appendChild(this.shell);

    this.viewport = new Viewport(this.shell, this.canvas);
    this.renderer = new CanvasRenderer(this.canvas, this.content, this.localization);
    this.simulation = new GameSimulation({
      content: this.content,
      localization: this.localization,
      analytics: this.analytics,
      adManager: this.adManager,
      iapManager: this.iapManager,
      saveService: this.saveService,
      configService: this.configService,
    });

    this.ui = new OverlayUI(this.overlayLayer, {
      onTogglePanel: (panel) => this.simulation.toggleUiPanel(panel),
      onGeneratorTap: (id) => {
        const result = this.simulation.tryGeneratorSpawn(id);
        if (!result.ok && result.reason === 'not_enough_energy') {
          this.simulation.toggleUiPanel('orders');
        }
      },
      onOrderComplete: (index) => {
        this.simulation.tryCompleteOrder(index);
      },
      onOrderReroll: (index) => {
        this.simulation.rerollOrder(index);
      },
      onEchoChoice: (option) => {
        this.simulation.chooseEchoOption(option);
      },
      onEnergyAd: () => {
        void this.simulation.watchEnergyAdIfEligible();
      },
      onClaimDailyChest: () => {
        this.simulation.claimDailyBonusChest();
      },
      onClaimLogin: () => {
        this.simulation.claimLoginReward();
      },
      onReadLetter: (id) => {
        this.simulation.readLetter(id);
      },
      onToggleFavorite: (id) => {
        this.simulation.toggleFavoriteLetter(id);
      },
      onResetSave: () => {
        this.simulation.resetSaveAndState();
      },
      onSoundToggle: (enabled) => {
        this.simulation.setSoundEnabled(enabled);
      },
      onMusicToggle: (enabled) => {
        this.simulation.setMusicEnabled(enabled);
      },
      onDebugGive: () => {
        this.simulation.debugGiveResources(500, 100, 50);
      },
      onDebugSpawn: (itemId) => {
        this.simulation.debugSpawnItem(itemId);
      },
      onDebugForceEcho: () => {
        this.simulation.forceEchoOnRandomEligible();
      },
      onDebugClearBoard: () => {
        this.simulation.debugClearBoard();
      },
      onRefreshConfig: () => {
        void this.simulation.refreshRemoteConfig();
      },
      onPurchase: (skuId) => {
        void this.simulation.purchaseSku(skuId);
      },
      onInventoryPage: (delta) => {
        this.simulation.nextInventoryPage(delta);
      },
      onDismissInboxNotice: () => {
        this.simulation.dismissInboxNotice();
      },
    });

    this.loop = new GameLoop(() => this.frame());
    this.input = new InputController(this.canvas, {
      onDown: (pointer) => this.onPointerDown(pointer),
      onMove: (pointer) => this.onPointerMove(pointer),
      onUp: (pointer) => this.onPointerUp(pointer),
    });

    this.simulation.subscribe((state) => {
      try {
        const branch = this.simulation.getCurrentBranchMoment();
        const debugItemIds = this.content.itemChains.flatMap((chain) => chain.tiers.map((tier) => tier.id));
        this.ui.update({
          state,
          orderDefinitions: this.simulation.getOrderDefinitionsForActive(),
          branchMoment: branch,
          analyticsEvents: this.simulation.getAnalyticsEvents(),
          debugItemIds,
          iapSkus: this.content.iapCatalog.map((sku) => ({
            id: sku.id,
            displayName: sku.displayName,
            priceText: sku.priceText,
          })),
        });
        this.updateTooltip(state);
      } catch (error) {
        this.recoverFromRuntimeError('state-update', error);
      }
    });

    this.unbindSession = this.analytics.attachSessionLifecycle(() => this.simulation.getState());

    const saveOnVisibility = () => {
      if (document.visibilityState === 'hidden') {
        this.simulation.saveNow();
      }
    };
    document.addEventListener('visibilitychange', saveOnVisibility);

    const saveOnUnload = () => {
      this.simulation.saveNow();
    };
    window.addEventListener('beforeunload', saveOnUnload);

    this.unbindVisibility = () => {
      document.removeEventListener('visibilitychange', saveOnVisibility);
      window.removeEventListener('beforeunload', saveOnUnload);
    };

    window.addEventListener('resize', () => this.viewport.fit());
    this.viewport.fit();
  }

  public start(): void {
    this.input.start();
    this.loop.start();
  }

  private frame(): void {
    try {
      const now = Date.now();
      this.simulation.tick(now);

      if (now - this.lastAutoSaveAt >= this.simulation.getState().config.autosaveSeconds * 1000) {
        this.simulation.saveNow();
        this.lastAutoSaveAt = now;
      }

      let dragRender: { itemId: string; x: number; y: number } | undefined;

      if (this.activeDrag && this.activeDrag.hasDragged) {
        dragRender = {
          itemId: this.activeDrag.itemUid,
          x: this.activeDrag.currentX,
          y: this.activeDrag.currentY,
        };
      } else if (this.returnAnimation) {
        const t = Math.min(1, (now - this.returnAnimation.startAt) / this.returnAnimation.durationMs);
        const eased = easeOutCubic(t);
        const x = this.returnAnimation.fromX + (this.returnAnimation.toX - this.returnAnimation.fromX) * eased;
        const y = this.returnAnimation.fromY + (this.returnAnimation.toY - this.returnAnimation.fromY) * eased;
        dragRender = {
          itemId: this.returnAnimation.itemUid,
          x,
          y,
        };
        if (t >= 1) {
          this.returnAnimation = null;
        }
      }

      this.renderer.render(this.simulation.getState(), {
        drag: dragRender,
        highlight: this.highlightTarget,
        readyGenerators: this.simulation.getReadyGeneratorIds(now),
      });
    } catch (error) {
      this.recoverFromRuntimeError('frame', error);
    }
  }

  private onPointerDown(pointer: PointerData): void {
    const point = this.viewport.toVirtual(pointer.x, pointer.y);
    const pickup = this.simulation.pickupAt(point.x, point.y);

    if (pointInRect(point.x, point.y, TRASH_RECT)) {
      this.clearTrashHoldTimer();
      this.trashHoldTimer = window.setTimeout(() => {
        this.simulation.bulkScrapLowTier();
      }, 650);
    }

    if (!pickup) {
      return;
    }

    const item = this.simulation.getItem(pickup.itemId);
    if (!item) {
      return;
    }

    this.activeDrag = {
      pointerId: pointer.id,
      itemUid: pickup.itemId,
      itemTypeId: item.itemId,
      originX: pickup.rect.x + pickup.rect.w / 2,
      originY: pickup.rect.y + pickup.rect.h / 2,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      hasDragged: false,
    };

    this.clearHoldTimer();
    this.holdTimer = window.setTimeout(() => {
      if (!this.activeDrag || this.activeDrag.hasDragged) {
        return;
      }
      this.simulation.startTooltip(pickup.itemId, point.x, point.y);
    }, 500);
  }

  private onPointerMove(pointer: PointerData): void {
    if (!this.activeDrag || this.activeDrag.pointerId !== pointer.id) {
      return;
    }

    const point = this.viewport.toVirtual(pointer.x, pointer.y);
    this.activeDrag.currentX = point.x;
    this.activeDrag.currentY = point.y;

    const distance = Math.hypot(point.x - this.activeDrag.startX, point.y - this.activeDrag.startY);
    if (!this.activeDrag.hasDragged && distance >= 10) {
      this.activeDrag.hasDragged = true;
      this.simulation.clearTooltip();
      this.clearHoldTimer();
    }

    if (this.activeDrag.hasDragged) {
      this.highlightTarget = this.simulation.previewDropTarget(point.x, point.y);
    }
  }

  private onPointerUp(pointer: PointerData): void {
    this.clearTrashHoldTimer();
    this.clearHoldTimer();
    this.highlightTarget = null;

    if (!this.activeDrag || this.activeDrag.pointerId !== pointer.id) {
      this.simulation.clearTooltip();
      return;
    }

    const point = this.viewport.toVirtual(pointer.x, pointer.y);
    const drag = this.activeDrag;

    if (drag.hasDragged) {
      const result = this.simulation.dropItem(drag.itemUid, point.x, point.y);
      if (!result.valid) {
        this.returnAnimation = {
          itemUid: drag.itemUid,
          fromX: drag.currentX,
          fromY: drag.currentY,
          toX: drag.originX,
          toY: drag.originY,
          startAt: Date.now(),
          durationMs: 200,
        };
      }
    } else {
      const now = Date.now();
      if (
        this.lastTap &&
        this.lastTap.itemTypeId === drag.itemTypeId &&
        now - this.lastTap.at <= 320 &&
        !this.simulation.isEchoChoiceOpen()
      ) {
        this.simulation.autoMergeByDoubleTap(drag.itemTypeId);
        this.lastTap = null;
      } else {
        this.lastTap = {
          itemTypeId: drag.itemTypeId,
          at: now,
        };
      }
      this.simulation.clearTooltip();
    }

    this.activeDrag = null;
  }

  private updateTooltip(state: ReturnType<GameSimulation['getState']>): void {
    const tooltipItemId = state.ui.showTooltipForItemId;
    if (!tooltipItemId || !state.ui.tooltipPosition) {
      this.tooltip.classList.add('hidden');
      return;
    }

    const text = this.simulation.getItemTooltip(tooltipItemId);
    if (!text) {
      this.tooltip.classList.add('hidden');
      return;
    }

    this.tooltip.classList.remove('hidden');
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${state.ui.tooltipPosition.x + 14}px`;
    this.tooltip.style.top = `${state.ui.tooltipPosition.y + 14}px`;
  }

  private recoverFromRuntimeError(source: 'state-update' | 'frame', error: unknown): void {
    console.error(`[game] Runtime error during ${source}`, error);
    if (this.recoveredFromRuntimeError) {
      return;
    }
    this.recoveredFromRuntimeError = true;
    this.simulation.resetSaveAndState();
  }

  private clearHoldTimer(): void {
    if (this.holdTimer != null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private clearTrashHoldTimer(): void {
    if (this.trashHoldTimer != null) {
      window.clearTimeout(this.trashHoldTimer);
      this.trashHoldTimer = null;
    }
  }

  public destroy(): void {
    this.loop.stop();
    this.input.stop();
    this.ui.destroy();
    this.clearHoldTimer();
    this.clearTrashHoldTimer();
    this.unbindSession?.();
    this.unbindVisibility?.();
  }
}
