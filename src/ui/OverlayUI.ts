import type { AnalyticsEvent } from '../services/AnalyticsManager';
import type { BranchMomentDefinition, OrderDefinition } from '../types/content';
import type { GameState } from '../types/game';
import { generateLetterShareImage } from '../services/ShareService';

export interface OverlayCallbacks {
  onTogglePanel: (panel: 'settings' | 'debug' | 'inbox' | 'inventory' | 'orders') => void;
  onGeneratorTap: (id: 'toolbox' | 'pantry') => void;
  onOrderComplete: (index: number) => void;
  onOrderReroll: (index: number) => void;
  onEchoChoice: (option: 'A' | 'B') => void;
  onEnergyAd: () => void;
  onClaimDailyChest: () => void;
  onClaimLogin: () => void;
  onReadLetter: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onResetSave: () => void;
  onSoundToggle: (enabled: boolean) => void;
  onMusicToggle: (enabled: boolean) => void;
  onDebugGive: () => void;
  onDebugSpawn: (itemId: string) => void;
  onDebugForceEcho: () => void;
  onDebugClearBoard: () => void;
  onRefreshConfig: () => void;
  onPurchase: (skuId: string) => void;
  onInventoryPage: (delta: 1 | -1) => void;
  onDismissInboxNotice: () => void;
}

export interface OverlayUpdate {
  state: GameState;
  orderDefinitions: OrderDefinition[];
  branchMoment: BranchMomentDefinition | null;
  analyticsEvents: AnalyticsEvent[];
  debugItemIds: string[];
  iapSkus: Array<{ id: string; displayName: string; priceText: string }>;
}

export class OverlayUI {
  private root: HTMLDivElement;
  private topBar: HTMLDivElement;
  private bottomBar: HTMLDivElement;
  private settingsPanel: HTMLDivElement;
  private debugPanel: HTMLDivElement;
  private inboxPanel: HTMLDivElement;
  private orderPanel: HTMLDivElement;
  private decorModal: HTMLDivElement;
  private adPrompt: HTMLButtonElement;
  private inboxNotice: HTMLButtonElement;
  private orderSlotsContainer: HTMLDivElement;
  private inboxList: HTMLDivElement;
  private inboxReader: HTMLDivElement;
  private debugAnalytics: HTMLDivElement;
  private debugSpawnSelect: HTMLSelectElement;
  private storePanel: HTMLDivElement;
  private liveOpsPanel: HTMLDivElement;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: OverlayCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay-ui';

    this.topBar = document.createElement('div');
    this.topBar.className = 'overlay-top';
    this.bottomBar = document.createElement('div');
    this.bottomBar.className = 'overlay-bottom';

    this.settingsPanel = document.createElement('div');
    this.settingsPanel.className = 'panel settings-panel hidden';
    this.debugPanel = document.createElement('div');
    this.debugPanel.className = 'panel debug-panel hidden';
    this.inboxPanel = document.createElement('div');
    this.inboxPanel.className = 'panel inbox-panel hidden';
    this.orderPanel = document.createElement('div');
    this.orderPanel.className = 'panel order-panel hidden';
    this.decorModal = document.createElement('div');
    this.decorModal.className = 'decor-modal hidden';

    this.adPrompt = document.createElement('button');
    this.adPrompt.className = 'ad-prompt hidden';
    this.adPrompt.textContent = 'Watch ad for +10 energy';
    this.adPrompt.addEventListener('click', () => this.callbacks.onEnergyAd());

    this.inboxNotice = document.createElement('button');
    this.inboxNotice.className = 'inbox-notice hidden';
    this.inboxNotice.addEventListener('click', () => this.callbacks.onDismissInboxNotice());

    this.orderSlotsContainer = document.createElement('div');
    this.orderSlotsContainer.className = 'order-slots';

    this.inboxList = document.createElement('div');
    this.inboxList.className = 'inbox-list';
    this.inboxReader = document.createElement('div');
    this.inboxReader.className = 'inbox-reader';

    this.debugAnalytics = document.createElement('div');
    this.debugAnalytics.className = 'debug-analytics';
    this.debugSpawnSelect = document.createElement('select');

    this.storePanel = document.createElement('div');
    this.storePanel.className = 'panel store-panel';

    this.liveOpsPanel = document.createElement('div');
    this.liveOpsPanel.className = 'liveops-panel';

    this.buildTopBar();
    this.buildBottomBar();
    this.buildSettingsPanel();
    this.buildDebugPanel();
    this.buildInboxPanel();
    this.buildOrderPanel();

    this.root.append(
      this.topBar,
      this.bottomBar,
      this.settingsPanel,
      this.debugPanel,
      this.inboxPanel,
      this.orderPanel,
      this.decorModal,
      this.adPrompt,
      this.inboxNotice,
      this.storePanel,
      this.liveOpsPanel,
    );
    this.container.appendChild(this.root);
  }

  public update(view: OverlayUpdate): void {
    const { state, orderDefinitions, branchMoment, analyticsEvents, debugItemIds, iapSkus } = view;

    this.settingsPanel.classList.toggle('hidden', !state.ui.showSettings);
    this.debugPanel.classList.toggle('hidden', !state.ui.showDebug);
    this.inboxPanel.classList.toggle('hidden', !state.ui.showInbox);
    this.orderPanel.classList.toggle('hidden', !state.ui.showOrderModal);
    this.decorModal.classList.toggle('hidden', !state.ui.showDecorModal);
    this.adPrompt.classList.toggle('hidden', state.energy.current > 10);

    this.inboxNotice.classList.toggle('hidden', !state.pendingInboxNotice);
    this.inboxNotice.textContent = state.pendingInboxNotice ?? '';

    this.renderOrderSlots(state, orderDefinitions);
    this.renderInbox(state);
    this.renderDecorModal(state, branchMoment);
    this.renderDebug(state, analyticsEvents, debugItemIds);
    this.renderStore(iapSkus);
    this.renderLiveOps(state);
  }

  public destroy(): void {
    this.root.remove();
  }

  private buildTopBar(): void {
    this.topBar.innerHTML = `
      <button data-action="inbox">Inbox</button>
      <button data-action="orders">Orders</button>
      <button data-action="inventory">Inventory</button>
      <button data-action="settings">Settings</button>
      <button data-action="debug">Debug</button>
      <button data-action="refresh">Refresh Config</button>
    `;

    this.topBar.querySelectorAll('button').forEach((button) => {
      const action = button.getAttribute('data-action');
      button.addEventListener('click', () => {
        if (action === 'refresh') {
          this.callbacks.onRefreshConfig();
          return;
        }
        if (
          action === 'inbox' ||
          action === 'orders' ||
          action === 'inventory' ||
          action === 'settings' ||
          action === 'debug'
        ) {
          this.callbacks.onTogglePanel(action);
        }
      });
    });
  }

  private buildBottomBar(): void {
    this.bottomBar.innerHTML = `
      <button class="gen-btn" data-gen="toolbox">Toolbox</button>
      <button class="gen-btn" data-gen="pantry">Pantry</button>
      <button class="daily-btn" data-liveops="daily">Daily Chest</button>
      <button class="login-btn" data-liveops="login">Login Reward</button>
      <button class="inv-page" data-page="prev">Inv ◀</button>
      <button class="inv-page" data-page="next">Inv ▶</button>
    `;

    this.bottomBar.querySelectorAll('.gen-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-gen');
        if (id === 'toolbox' || id === 'pantry') {
          this.callbacks.onGeneratorTap(id);
        }
      });
    });

    this.bottomBar.querySelector('[data-liveops="daily"]')?.addEventListener('click', () => {
      this.callbacks.onClaimDailyChest();
    });

    this.bottomBar.querySelector('[data-liveops="login"]')?.addEventListener('click', () => {
      this.callbacks.onClaimLogin();
    });

    this.bottomBar.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
      this.callbacks.onInventoryPage(-1);
    });

    this.bottomBar.querySelector('[data-page="next"]')?.addEventListener('click', () => {
      this.callbacks.onInventoryPage(1);
    });
  }

  private buildSettingsPanel(): void {
    this.settingsPanel.innerHTML = `
      <h3>Settings</h3>
      <label><input id="sound-toggle" type="checkbox" checked /> Sound</label>
      <label><input id="music-toggle" type="checkbox" checked /> Music</label>
      <button id="reset-save">Reset Save</button>
      <p class="credits">Credits: HTML5 Vertical Slice by Codex</p>
      <button id="close-settings">Close</button>
    `;

    const soundToggle = this.settingsPanel.querySelector<HTMLInputElement>('#sound-toggle');
    const musicToggle = this.settingsPanel.querySelector<HTMLInputElement>('#music-toggle');
    const resetSave = this.settingsPanel.querySelector<HTMLButtonElement>('#reset-save');
    const close = this.settingsPanel.querySelector<HTMLButtonElement>('#close-settings');

    soundToggle?.addEventListener('change', () => {
      this.callbacks.onSoundToggle(Boolean(soundToggle.checked));
    });
    musicToggle?.addEventListener('change', () => {
      this.callbacks.onMusicToggle(Boolean(musicToggle.checked));
    });
    resetSave?.addEventListener('click', () => {
      const ok = window.confirm('Reset all progress?');
      if (ok) {
        this.callbacks.onResetSave();
      }
    });
    close?.addEventListener('click', () => this.callbacks.onTogglePanel('settings'));
  }

  private buildDebugPanel(): void {
    const spawnRow = document.createElement('div');
    spawnRow.className = 'spawn-row';
    const spawnButton = document.createElement('button');
    spawnButton.textContent = 'Spawn Selected Item';
    spawnButton.addEventListener('click', () => {
      this.callbacks.onDebugSpawn(this.debugSpawnSelect.value);
    });
    spawnRow.append(this.debugSpawnSelect, spawnButton);

    const giveButton = document.createElement('button');
    giveButton.textContent = 'Give 500c / 100⭐ / 50⚡';
    giveButton.addEventListener('click', () => this.callbacks.onDebugGive());

    const forceEcho = document.createElement('button');
    forceEcho.textContent = 'Force Echo';
    forceEcho.addEventListener('click', () => this.callbacks.onDebugForceEcho());

    const clearBoard = document.createElement('button');
    clearBoard.textContent = 'Clear Board';
    clearBoard.addEventListener('click', () => this.callbacks.onDebugClearBoard());

    const close = document.createElement('button');
    close.textContent = 'Close Debug';
    close.addEventListener('click', () => this.callbacks.onTogglePanel('debug'));

    this.debugPanel.append(
      document.createElement('h3').appendChild(document.createTextNode('Debug Tools')).parentElement as Node,
      giveButton,
      forceEcho,
      clearBoard,
      spawnRow,
      this.debugAnalytics,
      close,
    );
  }

  private buildInboxPanel(): void {
    const close = document.createElement('button');
    close.textContent = 'Close Inbox';
    close.addEventListener('click', () => this.callbacks.onTogglePanel('inbox'));

    this.inboxPanel.append(
      document.createElement('h3').appendChild(document.createTextNode('Inbox')).parentElement as Node,
      this.inboxList,
      this.inboxReader,
      close,
    );
  }

  private buildOrderPanel(): void {
    const close = document.createElement('button');
    close.textContent = 'Close Orders';
    close.addEventListener('click', () => this.callbacks.onTogglePanel('orders'));

    this.orderPanel.append(
      document.createElement('h3').appendChild(document.createTextNode('Orders')).parentElement as Node,
      this.orderSlotsContainer,
      close,
    );
  }

  private renderOrderSlots(state: GameState, orderDefinitions: OrderDefinition[]): void {
    this.orderSlotsContainer.innerHTML = '';
    orderDefinitions.forEach((definition, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'order-slot';
      const timed = state.ordersActive[index]?.expiresAt;
      const remaining = timed ? Math.max(0, Math.ceil((timed - state.now) / 1000)) : null;
      wrapper.innerHTML = `
        <h4>${definition.id}</h4>
        <p>${definition.type}</p>
        <p>Req: ${definition.requirements.map((req) => `${req.chainId} T${req.tier}x${req.count}`).join(', ')}</p>
        <p>Reward: ${definition.rewards.coins}c ${definition.rewards.stars}⭐ ${definition.rewards.xp}xp</p>
        ${remaining != null ? `<p>Timed: ${remaining}s</p>` : ''}
      `;

      const complete = document.createElement('button');
      complete.textContent = 'Complete';
      complete.addEventListener('click', () => this.callbacks.onOrderComplete(index));

      const reroll = document.createElement('button');
      reroll.textContent = `Reroll (${index === 0 && !state.reroll.freeUsed ? 'Free' : `${state.reroll.gemCost} gems`})`;
      reroll.addEventListener('click', () => this.callbacks.onOrderReroll(index));

      wrapper.append(complete, reroll);
      this.orderSlotsContainer.appendChild(wrapper);
    });
  }

  private renderInbox(state: GameState): void {
    const sorted = [...state.letters].sort((a, b) => {
      const unreadDelta = Number(a.readAt != null) - Number(b.readAt != null);
      if (unreadDelta !== 0) {
        return unreadDelta;
      }
      return b.receivedAt - a.receivedAt;
    });

    this.inboxList.innerHTML = '';
    for (const letter of sorted) {
      const row = document.createElement('button');
      row.className = `letter-row ${letter.readAt ? 'read' : 'unread'}`;
      row.textContent = `${letter.title} ${letter.isFavorite ? '★' : ''}`;
      row.addEventListener('click', () => this.callbacks.onReadLetter(letter.id));
      this.inboxList.appendChild(row);
    }

    const selected = state.letters.find((entry) => entry.id === state.ui.selectedLetterId) ?? sorted[0];
    if (!selected) {
      this.inboxReader.innerHTML = '<p>No letters yet.</p>';
      return;
    }

    this.inboxReader.innerHTML = `
      <h4>${selected.title}</h4>
      <div class="parchment">${selected.body.split('\n').join('<br/>')}</div>
    `;

    const fav = document.createElement('button');
    fav.textContent = selected.isFavorite ? 'Unfavorite' : 'Favorite';
    fav.addEventListener('click', () => this.callbacks.onToggleFavorite(selected.id));

    const share = document.createElement('button');
    share.textContent = 'Save Image';
    share.addEventListener('click', () => {
      const uri = generateLetterShareImage({
        title: selected.title,
        body: selected.body,
        referralCode: 'REF-TMRW-0000',
      });
      const anchor = document.createElement('a');
      anchor.href = uri;
      anchor.download = `${selected.id}.png`;
      anchor.click();
    });

    this.inboxReader.append(fav, share);
  }

  private renderDecorModal(state: GameState, branchMoment: BranchMomentDefinition | null): void {
    if (!state.ui.showDecorModal || !branchMoment) {
      this.decorModal.innerHTML = '';
      return;
    }

    this.decorModal.innerHTML = `
      <div class="decor-card">
        <h3>Time Echo Choice</h3>
        <p>Choose This Future</p>
        <div class="options">
          <button id="optA" class="choice-card">
            <h4>${branchMoment.optionA.title}</h4>
            <p>${branchMoment.optionA.description}</p>
            <p>Reward: 3x Stars + Exclusive Letter</p>
          </button>
          <button id="optB" class="choice-card">
            <h4>${branchMoment.optionB.title}</h4>
            <p>${branchMoment.optionB.description}</p>
            <p>Reward: 3x Stars + Exclusive Letter</p>
          </button>
        </div>
      </div>
    `;

    this.decorModal.querySelector('#optA')?.addEventListener('click', () => this.callbacks.onEchoChoice('A'));
    this.decorModal.querySelector('#optB')?.addEventListener('click', () => this.callbacks.onEchoChoice('B'));
  }

  private renderDebug(state: GameState, events: AnalyticsEvent[], itemIds: string[]): void {
    const current = new Set(Array.from(this.debugSpawnSelect.options).map((entry) => entry.value));
    for (const itemId of itemIds) {
      if (current.has(itemId)) {
        continue;
      }
      const option = document.createElement('option');
      option.value = itemId;
      option.textContent = itemId;
      this.debugSpawnSelect.appendChild(option);
    }

    this.debugAnalytics.innerHTML = '<h4>Analytics (latest 20)</h4>';
    for (const event of events.slice(0, 20)) {
      const row = document.createElement('div');
      row.className = 'analytics-row';
      row.textContent = `${new Date(event.at).toLocaleTimeString()} ${event.name}`;
      this.debugAnalytics.appendChild(row);
    }

    const sound = this.settingsPanel.querySelector<HTMLInputElement>('#sound-toggle');
    const music = this.settingsPanel.querySelector<HTMLInputElement>('#music-toggle');
    if (sound) {
      sound.checked = state.ui.soundEnabled;
    }
    if (music) {
      music.checked = state.ui.musicEnabled;
    }
  }

  private renderStore(skus: Array<{ id: string; displayName: string; priceText: string }>): void {
    this.storePanel.innerHTML = '<h4>Store (IAP Stub)</h4>';
    for (const sku of skus) {
      const button = document.createElement('button');
      button.textContent = `${sku.displayName} ${sku.priceText}`;
      button.addEventListener('click', () => this.callbacks.onPurchase(sku.id));
      this.storePanel.appendChild(button);
    }
  }

  private renderLiveOps(state: GameState): void {
    this.liveOpsPanel.innerHTML = '<h4>LiveOps</h4>';

    const streak = document.createElement('p');
    streak.textContent = `Login streak: Day ${state.liveOps.loginStreak}/7`;
    this.liveOpsPanel.appendChild(streak);

    const tasks = document.createElement('div');
    tasks.className = 'task-list';
    for (const task of state.liveOps.dailyTasks) {
      const row = document.createElement('p');
      row.textContent = `${task.id}: ${task.progress}/${task.target}`;
      row.className = task.complete ? 'task-complete' : '';
      tasks.appendChild(row);
    }
    this.liveOpsPanel.appendChild(tasks);

    const weekly = document.createElement('p');
    weekly.textContent = `Weekly event points: ${state.liveOps.weeklyEventPoints}`;
    this.liveOpsPanel.appendChild(weekly);
  }
}
