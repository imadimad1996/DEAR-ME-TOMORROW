import * as PIXI from 'pixi.js';
import type { IScene } from '../engine/SceneManager';
import type { GameContext } from '../engine/Game';
import economy from '../data/economy.default.json';
import ordersRaw from '../data/orders.default.json';
import lettersRaw from '../data/letters.json';
import { Board, type BoardSaveItem } from '../systems/merge/Board';
import type { ChainId } from '../systems/merge/ChainsData';
import { OrdersSystem, type ActiveOrder, type OrderTemplate } from '../systems/orders/OrdersSystem';
import { OrderUI } from '../systems/orders/OrderUI';
import { EnergySystem } from '../systems/energy/EnergySystem';
import { EnergyUI } from '../systems/energy/EnergyUI';
import { EchoSystem } from '../systems/echo/EchoSystem';
import { EchoOverlay } from '../systems/echo/EchoOverlay';
import { BoosterSystem } from '../systems/boosters/BoosterSystem';
import { BoosterUI } from '../systems/boosters/BoosterUI';
import { LettersSystem } from '../systems/narrative/LettersSystem';
import { LettersUI } from '../systems/narrative/LettersUI';
import { Parallax } from '../systems/rooms/Parallax';
import { RoomLighting } from '../systems/rooms/RoomLighting';
import { RoomRevealCinematic } from '../systems/rooms/RoomRevealCinematic';
import { TopBar } from '../ui/TopBar';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { RewardedAdFlowUI } from '../systems/ads/RewardedAdFlowUI';
import { SaveLoad, type SaveState } from '../systems/SaveLoad';
import { ScrapBlocker } from '../systems/merge/ScrapBlocker';
import { AnalyticsEvents } from '../systems/analytics/Events';
import { Easing } from '../utils/easing';

interface CurrencyState {
  coins: number;
  gems: number;
  stars: number;
}

export class MergeBoardScene implements IScene {
  public readonly id = 'merge-board';
  public readonly container = new PIXI.Container();

  private readonly saveLoad = new SaveLoad();
  private readonly background = new PIXI.Container();
  private readonly parallax = new Parallax();
  private readonly lighting = new RoomLighting(1080, 1920);
  private readonly board: Board;
  private readonly orderSystem: OrdersSystem;
  private energySystem: EnergySystem;
  private readonly echoSystem: EchoSystem;
  private readonly echoOverlay = new EchoOverlay();
  private readonly boosterSystem = new BoosterSystem(economy.boosters);
  private readonly lettersSystem = new LettersSystem(lettersRaw, this.ctx.analytics);
  private readonly roomReveal: RoomRevealCinematic;

  private readonly topBar = new TopBar();
  private readonly energyUI = new EnergyUI();
  private readonly orderUI: OrderUI;
  private readonly boosterUI: BoosterUI;
  private readonly lettersUI: LettersUI;
  private readonly tooltip = new Tooltip();
  private readonly adFlow = new RewardedAdFlowUI(this.ctx.adService);

  private readonly spawnWoodButton: Button;
  private readonly spawnFoodButton: Button;
  private readonly scrapToolButton: Button;
  private readonly adButton: Button;
  private readonly roomButton: Button;
  private readonly matchButton: Button;
  private readonly dailyButton: Button;
  private readonly starterPackButton: Button;

  private readonly buttons: Button[] = [];

  private currencies: CurrencyState = {
    coins: economy.currencies.coins,
    gems: economy.currencies.gems,
    stars: economy.currencies.stars,
  };

  private toast = new PIXI.Text('', {
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 30,
    fill: 0xf6f1e9,
  });
  private toastUntil = 0;

  private readonly dailyPopup = new PIXI.Container();
  private readonly starterPackModal = new PIXI.Container();

  private lastSaveAt = 0;
  private loaded = false;
  private lastFailedActionAt = 0;
  private roomPacingLogged = false;
  private readonly rewardDelayMs: number;
  private readonly ctaGlowAlpha: number;

  constructor(private readonly ctx: GameContext) {
    const ab = ctx.abConfig.getVariant();
    this.rewardDelayMs = Math.round(ab.rewardDelay * 1000);
    this.ctaGlowAlpha = ab.ctaGlowIntensity === 'low' ? 0.8 : ab.ctaGlowIntensity === 'med' ? 0.9 : 1;

    const scrapBlocker = new ScrapBlocker();

    this.board = new Board(
      economy.board.cols,
      economy.board.rows,
      104,
      this.ctx.tween,
      this.ctx.vfx,
      this.ctx.audio,
      this.ctx.analytics,
      scrapBlocker,
      {
        onMerged: (item) => this.onMerged(item),
        onMergeFailed: (message) => this.showToast(message),
        onLegendaryMerge: () => this.triggerLegendaryCinematic(),
        onShake: (strength, durationMs) => this.shakeBoard(strength, durationMs),
        onBoardClutter: (blockedCells) => {
          this.lastFailedActionAt = Date.now();
          this.showToast('Board is crowded. Maybe clear some scrap?');
          this.ctx.analytics.log(AnalyticsEvents.BOARD_CLUTTER_EVENTS, { blockedCells });
        },
      },
    );

    this.orderSystem = new OrdersSystem(ordersRaw as OrderTemplate[], this.ctx.analytics, economy.orders.maxActive);
    this.energySystem = new EnergySystem(
      economy.energy.max,
      ab.energyRegenMinutes,
      this.ctx.analytics,
      economy.energy.max,
      Date.now(),
    );

    this.echoSystem = new EchoSystem(ab.echoChance, this.ctx.analytics);

    this.orderUI = new OrderUI((index) => {
      this.orderSystem.reroll(index);
      this.orderUI.setOrders(this.orderSystem.getActive());
      this.showToast('Order rerolled. Fresh drama incoming.');
    });

    this.boosterUI = new BoosterUI((type) => {
      this.useBooster(type);
    });

    this.lettersUI = new LettersUI(
      (id) => this.lettersSystem.openLetter(id),
      (id, skipped) => this.lettersSystem.closeLetter(id, skipped),
    );

    this.roomReveal = new RoomRevealCinematic(this.container, this.ctx.tween, this.ctx.vfx);

    this.spawnWoodButton = this.makeButton('Toolbench', 52, 1620, () => this.spawnFromGenerator('wood'));
    this.spawnFoodButton = this.makeButton('Pantry', 252, 1620, () => this.spawnFromGenerator('culinary'));
    this.scrapToolButton = this.makeButton('Scrap Tool', 452, 1620, () => this.useScrapTool());
    this.adButton = this.makeButton('Energy Ad', 652, 1620, () => this.simulateRewardedAd());
    this.roomButton = this.makeButton('Room View', 852, 1620, () => this.ctx.sceneManager.switchTo('room-entrance-hall'));
    this.matchButton = this.makeButton('Mini Mode', 852, 1700, () => this.ctx.sceneManager.switchTo('match-mini'));
    this.dailyButton = this.makeButton('Daily Reward', 652, 1700, () => this.openDailyPopup());
    this.starterPackButton = this.makeButton('Starter Pack', 452, 1700, () => this.openStarterPack());

    this.setupLayout();
    this.bindTooltips();
  }

  public enter(_previousSceneId: string | null): void {
    if (!this.loaded) {
      this.initializeBoard();
      this.loadState();
      this.loaded = true;
    }
    this.refreshUI();
  }

  public exit(_nextSceneId: string): void {
    this.saveState();
    if (Date.now() - this.lastFailedActionAt <= 10000) {
      this.ctx.analytics.log(AnalyticsEvents.RAGE_QUIT_PROXY, {
        withinMs: Date.now() - this.lastFailedActionAt,
      });
    }
  }

  public resize(_width: number, _height: number): void {}

  public update(deltaMs: number): void {
    const now = Date.now();

    const energyBefore = this.energySystem.getCurrent();
    this.energySystem.update(now);
    if (this.energySystem.getCurrent() > energyBefore) {
      this.energyUI.playRefillPulse();
      this.ctx.audio.play('chime', 0.25);
    }
    this.board.update(deltaMs, this.ctx.time.elapsedMs);
    this.parallax.update(deltaMs);
    this.lighting.update(deltaMs);
    this.echoOverlay.sync(this.board.getItems());
    this.echoOverlay.update(this.board.getItems(), this.ctx.time.elapsedMs);
    this.echoSystem.clearIfMissing(this.board.getItems().map((item) => item.uid));

    this.topBar.update(deltaMs);
    this.energyUI.update(deltaMs);
    this.orderUI.update(deltaMs);
    this.boosterUI.update(deltaMs);
    this.lettersUI.update(deltaMs);

    this.buttons.forEach((button) => button.update(deltaMs));

    if (now > this.toastUntil) {
      this.toast.alpha = Math.max(0, this.toast.alpha - deltaMs / 200);
    }

    this.animateStarterPack();

    this.refreshUI();

    if (now - this.lastSaveAt > 5000) {
      this.saveState();
    }

    if (!this.roomPacingLogged && this.currencies.stars >= 5) {
      this.roomPacingLogged = true;
      this.ctx.analytics.log(AnalyticsEvents.ROOM_COMPLETION_PACING, {
        roomId: 'entrance_hall',
        stars: this.currencies.stars,
      });
    }
  }

  public debugSpawn(chainId: ChainId, tier: number): void {
    this.board.spawnItem(chainId, tier);
  }

  public triggerLegendaryCinematic(): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.2).drawRect(0, 0, 1080, 1920).endFill();
    this.container.addChild(overlay);

    this.board.container.eventMode = 'none';
    window.setTimeout(() => {
      this.board.container.eventMode = 'static';
    }, 200);

    this.ctx.time.withScale(0.6, 500);

    this.ctx.tween.to(this.container.scale, { x: 1.08, y: 1.08 }, 300, Easing.easeOutQuad, () => {
      this.ctx.tween.to(this.container.scale, { x: 1, y: 1 }, 500, Easing.easeOutQuad);
    });

    this.ctx.vfx.burst(540, 980, 0xf4c542, 60, 260, 1200);

    const shockwave = new PIXI.Graphics();
    shockwave.lineStyle(4, 0xffe79e, 0.9).drawCircle(0, 0, 10);
    shockwave.position.set(540, 980);
    this.container.addChild(shockwave);

    this.ctx.tween.to(shockwave.scale, { x: 6, y: 6 }, 300, Easing.easeOutQuad, () => {
      shockwave.removeFromParent();
    });
    this.ctx.tween.to(shockwave, { alpha: 0 }, 300);

    this.ctx.tween.to(overlay, { alpha: 0 }, 500, Easing.linear, () => {
      overlay.removeFromParent();
    });
  }

  public triggerEchoChoiceCinematicStub(): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x08121d, 0.9).drawRect(0, 0, 1080, 1920).endFill();
    overlay.alpha = 0;
    this.container.addChild(overlay);

    const portal = PIXI.Sprite.from('/assets/echo/echo_slot_ui.png');
    portal.anchor.set(0.5);
    portal.position.set(540, 960);
    portal.width = 320;
    portal.height = 320;
    this.container.addChild(portal);

    this.ctx.tween.to(overlay, { alpha: 0.9 }, 250, Easing.easeOutQuad, () => {
      this.ctx.tween.to(overlay, { alpha: 0 }, 450, Easing.easeOutQuad, () => {
        overlay.removeFromParent();
        portal.removeFromParent();
      });
    });
  }

  public triggerRoomRevealCinematic(): void {
    this.roomReveal.playEntranceHallReveal(() => {
      this.showToast('Entrance Hall feels warmer already.');
    });
  }

  public simulateRewardedAd(): void {
    this.ctx.analytics.log(AnalyticsEvents.AD_OPT_IN, {
      source: 'merge_board',
    });
    this.adFlow.show((completed) => {
      this.ctx.analytics.log(AnalyticsEvents.AD_COMPLETE, {
        completed,
      });
      if (completed) {
        this.energySystem.grant(10);
        this.energyUI.playRefillPulse();
        this.ctx.vfx.burst(800, 70, 0x84f7d0, 24, 90, 800);
        this.showToast('Nice choice. Energy topped up.');
      } else {
        this.showToast('Ad skipped. Coffee break still valid.');
      }
    });
  }

  private setupLayout(): void {
    this.parallax.addLayer('/assets/rooms/entrance_hall/classic_before.png', 0.2, 1080, 1920);
    this.parallax.addLayer('/assets/rooms/entrance_hall/modern_before.png', 0.4, 1080, 1920);
    this.parallax.addLayer('/assets/rooms/entrance_hall/future_before.png', 0.7, 1080, 1920);

    this.background.addChild(this.parallax.container, this.lighting.container);

    this.board.container.position.set(124, 420);
    this.board.container.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      const nx = ((event.globalX / 1080) - 0.5) * 6;
      const ny = ((event.globalY / 1920) - 0.5) * 4;
      this.parallax.setDragOffset(nx, ny);
    });
    this.board.container.on('pointerup', () => this.parallax.release());
    this.board.container.on('pointerupoutside', () => this.parallax.release());

    const frame = PIXI.Sprite.from('/assets/ui/merge_board_frame.png');
    frame.width = 860;
    frame.height = 1060;
    frame.alpha = 0.9;
    frame.position.set(110, 402);

    const echoSlot = PIXI.Sprite.from('/assets/echo/echo_slot_ui.png');
    echoSlot.anchor.set(0.5);
    echoSlot.position.set(980, 1460);
    echoSlot.width = 120;
    echoSlot.height = 120;
    echoSlot.alpha = 0.7;

    const roomTitle = new PIXI.Text('Entrance Hall • Cozy Classic', {
      fontFamily: 'Georgia, serif',
      fontSize: 34,
      fill: 0xf6f1e9,
    });
    roomTitle.position.set(30, 130);

    this.energyUI.container.position.set(24, 74);

    this.toast.anchor.set(0.5);
    this.toast.position.set(540, 1550);
    this.toast.alpha = 0;

    this.orderUI.attach(this.container);
    this.boosterUI.container.position.set(0, 0);

    this.lettersUI.setLetters(this.lettersSystem.getLetters());

    this.container.addChild(
      this.background,
      frame,
      this.board.container,
      this.echoOverlay.container,
      echoSlot,
      this.topBar.container,
      roomTitle,
      this.energyUI.container,
      this.spawnWoodButton.container,
      this.spawnFoodButton.container,
      this.scrapToolButton.container,
      this.adButton.container,
      this.roomButton.container,
      this.matchButton.container,
      this.dailyButton.container,
      this.starterPackButton.container,
      this.boosterUI.container,
      this.lettersUI.container,
      this.tooltip.container,
      this.toast,
      this.adFlow.container,
    );

    this.createDailyPopup();
    this.createStarterPackModal();
  }

  private bindTooltips(): void {
    const bind = (button: Button, text: string, x: number, y: number) => {
      button.container.on('pointerover', () => this.tooltip.show(text, x, y));
      button.container.on('pointerout', () => this.tooltip.hide());
    };

    bind(this.spawnWoodButton, 'Spend 1 energy to spawn wood items.', 42, 1520);
    bind(this.spawnFoodButton, 'Spend 1 energy to spawn culinary items.', 242, 1520);
    bind(this.scrapToolButton, 'Spend 2 energy to clear one scrap blocker.', 442, 1520);
  }

  private initializeBoard(): void {
    this.board.randomizeScrap(economy.board.initialScrapCount);
    for (let i = 0; i < 12; i += 1) {
      const chain: ChainId = i % 2 === 0 ? 'wood' : 'culinary';
      this.board.spawnItem(chain, 1);
    }
    this.orderUI.setOrders(this.orderSystem.getActive());
    this.boosterUI.updateInventory(this.boosterSystem.getInventory());
  }

  private spawnFromGenerator(chainId: ChainId): void {
    const energyCost = economy.board.spawnEnergyCost;
    if (!this.energySystem.spend(energyCost)) {
      this.lastFailedActionAt = Date.now();
      this.showToast('Coffee break? Your future self approves.');
      return;
    }

    const tier = Math.random() < 0.2 ? 2 : 1;
    const spawned = this.board.spawnItem(chainId, tier);
    if (!spawned) {
      this.energySystem.grant(energyCost);
      this.lastFailedActionAt = Date.now();
      return;
    }

    this.ctx.audio.play('click', 0.4);
  }

  private onMerged(item: any): void {
    const reward = this.orderSystem.onItemMerged(item);
    if (reward) {
      window.setTimeout(() => {
        this.currencies.coins += reward.coins;
        this.energySystem.grant(reward.energy);
        if (reward.booster > 0) {
          this.boosterSystem.grant('extra_energy', reward.booster);
        }
        this.orderUI.setOrders(this.orderSystem.getActive());
        this.orderUI.pulseComplete();
        this.energyUI.playRefillPulse();
        this.animateCoinsArc(12);
        this.ctx.audio.play('success', 0.65);
        this.showToast('You did a tiny miracle.');
      }, this.rewardDelayMs);
    }

    if (this.echoSystem.evaluateMerge(item)) {
      this.board.setItemEcho(item.uid, true);
      this.showToast('Echo shimmer unlocked.');
      this.ctx.audio.play('chime', 0.6);
    }

    this.boosterUI.updateInventory(this.boosterSystem.getInventory());
  }

  private useScrapTool(): void {
    if (!this.energySystem.spend(2)) {
      this.showToast('Coffee break? Your future self approves.');
      this.lastFailedActionAt = Date.now();
      return;
    }
    const cleared = this.board.clearRandomScrapCell();
    if (cleared) {
      this.showToast('Clutter cleared. Breathing room achieved.');
      this.ctx.audio.play('success', 0.4);
    } else {
      this.showToast('No scrap left. Flex quietly.');
      this.energySystem.grant(2);
    }
  }

  private useBooster(type: 'extra_energy' | 'merge_joker' | 'time_skip'): void {
    if (!this.boosterSystem.consume(type)) {
      this.showToast('Booster empty. Not dramatic, just empty.');
      return;
    }

    if (type === 'extra_energy') {
      this.energySystem.grant(12);
      this.energyUI.playRefillPulse();
      this.showToast('Extra Energy activated.');
    }

    if (type === 'merge_joker') {
      this.board.spawnItem('wood', 3, undefined, undefined, true);
      this.showToast('Merge Joker dropped on board.');
    }

    if (type === 'time_skip') {
      this.energySystem.grant(8);
      this.energyUI.playRefillPulse();
      this.showToast('Time Skip: tomorrow arrived early.');
    }

    this.boosterUI.updateInventory(this.boosterSystem.getInventory());
  }

  private refreshUI(): void {
    this.topBar.setValues({
      energy: this.energySystem.getCurrent(),
      energyMax: this.energySystem.getMax(),
      coins: this.currencies.coins,
      gems: this.currencies.gems,
      stars: this.currencies.stars,
    });

    this.energyUI.setEnergy(this.energySystem.getCurrent(), this.energySystem.getMax());
  }

  private showToast(text: string): void {
    this.toast.text = text;
    this.toast.alpha = 1;
    this.toastUntil = Date.now() + 1600;
  }

  private shakeBoard(strength: number, durationMs: number): void {
    const startX = this.board.container.x;
    const startY = this.board.container.y;
    const start = Date.now();

    const tick = () => {
      const t = (Date.now() - start) / durationMs;
      if (t >= 1) {
        this.board.container.position.set(startX, startY);
        return;
      }
      const falloff = 1 - t;
      this.board.container.position.set(
        startX + (Math.random() - 0.5) * strength * falloff,
        startY + (Math.random() - 0.5) * strength * falloff,
      );
      requestAnimationFrame(tick);
    };

    tick();
  }

  private animateCoinsArc(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const coin = PIXI.Sprite.from('/assets/ui/currency_coin.png');
      coin.anchor.set(0.5);
      coin.width = 18;
      coin.height = 18;
      coin.position.set(860 + Math.random() * 40, 540 + Math.random() * 30);
      this.container.addChild(coin);

      const targetX = 390;
      const targetY = 30;
      const controlX = (coin.x + targetX) / 2 + (Math.random() - 0.5) * 60;
      const controlY = coin.y - 120 - Math.random() * 80;
      const start = { x: coin.x, y: coin.y };
      const duration = 1000;
      const begun = performance.now();

      const step = () => {
        const now = performance.now();
        const t = Math.min(1, (now - begun) / duration);
        const it = 1 - t;
        coin.x = it * it * start.x + 2 * it * t * controlX + t * t * targetX;
        coin.y = it * it * start.y + 2 * it * t * controlY + t * t * targetY;
        coin.alpha = 1 - t * 0.8;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          coin.removeFromParent();
        }
      };
      step();
    }
  }

  private createDailyPopup(): void {
    this.dailyPopup.visible = false;

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.45).drawRect(0, 0, 1080, 1920).endFill();
    const card = new PIXI.Graphics();
    card.beginFill(0x1b2b3c, 0.96).drawRoundedRect(170, 620, 740, 420, 24).endFill();
    card.lineStyle(3, 0xf4c542, 0.85).drawRoundedRect(170, 620, 740, 420, 24);

    const title = new PIXI.Text('Daily Reward (Stub)', {
      fontFamily: 'Georgia, serif',
      fontSize: 42,
      fill: 0xf6f1e9,
    });
    title.position.set(280, 680);

    const body = new PIXI.Text('Claim +50 coins and +5 gems. Tomorrow you can stack this with luck.', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: 26,
      fill: 0xf6f1e9,
      wordWrap: true,
      wordWrapWidth: 620,
    });
    body.position.set(230, 760);

    const claim = new Button('Claim', () => {
      this.currencies.coins += 50;
      this.currencies.gems += 5;
      this.dailyPopup.visible = false;
      this.showToast('Daily reward claimed. Tiny victory logged.');
    }, 200, 64);
    claim.container.position.set(320, 920);

    const close = new Button('Close', () => {
      this.dailyPopup.visible = false;
    }, 200, 64);
    close.container.position.set(560, 920);

    this.buttons.push(claim, close);
    this.dailyPopup.addChild(dim, card, title, body, claim.container, close.container);
    this.container.addChild(this.dailyPopup);
  }

  private createStarterPackModal(): void {
    this.starterPackModal.visible = false;

    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.55).drawRect(0, 0, 1080, 1920).endFill();

    const card = new PIXI.Graphics();
    card.beginFill(0x12263a, 0.98).drawRoundedRect(170, 520, 740, 600, 26).endFill();
    card.lineStyle(3, 0xf4c542, 0.95).drawRoundedRect(170, 520, 740, 600, 26);

    const ribbon = new PIXI.Graphics();
    ribbon.beginFill(0xff6f61, 1).drawRoundedRect(640, 560, 210, 54, 10).endFill();
    const ribbonText = new PIXI.Text('BEST VALUE', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '700',
    });
    ribbonText.position.set(664, 573);

    const title = new PIXI.Text('Starter Pack', {
      fontFamily: 'Georgia, serif',
      fontSize: 46,
      fill: 0xf6f1e9,
    });
    title.position.set(280, 590);

    const desc = new PIXI.Text(
      `Coins +300  •  Gems +50  •  Energy +20\nOnly $${this.ctx.abConfig.getVariant().starterPackPrice.toFixed(2)} today`,
      {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: 28,
        fill: 0xf6f1e9,
      },
    );
    desc.position.set(240, 700);

    const countdown = new PIXI.Text('Offer ends in 09:59', {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: 28,
      fill: 0x9eefff,
    });
    countdown.position.set(390, 830);

    const buy = new Button('Buy (Stub)', () => {
      this.starterPackModal.visible = false;
      this.currencies.coins += 300;
      this.currencies.gems += 50;
      this.energySystem.grant(20);
      this.showToast('Starter pack applied. Mansion morale up.');
    }, 250, 72);
    buy.container.position.set(300, 950);

    const close = new Button('Maybe Later', () => {
      this.starterPackModal.visible = false;
    }, 250, 72);
    close.container.position.set(560, 950);

    this.buttons.push(buy, close);

    this.starterPackModal.addChild(
      dim,
      card,
      ribbon,
      ribbonText,
      title,
      desc,
      countdown,
      buy.container,
      close.container,
    );
    this.starterPackModal.pivot.set(540, 960);
    this.starterPackModal.position.set(540, 960);
    this.container.addChild(this.starterPackModal);
  }

  private animateStarterPack(): void {
    if (!this.starterPackModal.visible) {
      return;
    }
    const t = Date.now() / 1000;
    this.starterPackModal.rotation = Math.sin(t * 1.4) * 0.01;
    const scale = 1 + Math.sin(t * 2.2) * 0.01;
    this.starterPackModal.scale.set(scale);
  }

  private openDailyPopup(): void {
    this.dailyPopup.visible = true;
  }

  private openStarterPack(): void {
    this.starterPackModal.visible = true;
  }

  private makeButton(label: string, x: number, y: number, onClick: () => void): Button {
    const button = new Button(label, onClick, 180, 64);
    button.container.position.set(x, y);
    button.container.alpha = this.ctaGlowAlpha;
    this.buttons.push(button);
    return button;
  }

  private loadState(): void {
    const save = this.saveLoad.load();
    if (!save) {
      return;
    }

    this.currencies = { ...save.currencies };

    this.board.loadFromSave(save.board.items as BoardSaveItem[]);
    this.orderSystem.setActive(save.orders.active as ActiveOrder[]);
    this.orderUI.setOrders(this.orderSystem.getActive());

    this.energySystem = new EnergySystem(
      save.energy.max,
      save.energy.regenMinutes,
      this.ctx.analytics,
      save.energy.current,
      save.energy.lastTickAt,
    );

    this.boosterSystem.setInventory(save.boosters);
    this.boosterUI.updateInventory(this.boosterSystem.getInventory());

    this.lettersSystem.loadProgress(save.letters.progress);
    this.echoSystem.load(save.echo);

    this.echoSystem.getActiveIds().forEach((id) => {
      this.board.setItemEcho(id, true);
    });
  }

  private saveState(): void {
    const state: SaveState = {
      version: 1,
      currencies: { ...this.currencies },
      board: {
        items: this.board.toSaveItems(),
      },
      orders: {
        active: this.orderSystem.toSave(),
      },
      energy: this.energySystem.toSave(),
      room: {
        currentRoomId: 'entrance_hall',
        style: 'classic',
      },
      letters: {
        progress: this.lettersSystem.getProgress(),
      },
      boosters: this.boosterSystem.getInventory(),
      echo: this.echoSystem.toSave(),
      savedAt: Date.now(),
    };

    this.saveLoad.save(state);
    this.lastSaveAt = Date.now();
  }
}
