import * as PIXI from 'pixi.js';
import { SceneManager } from './SceneManager';
import { Time } from './Time';
import { TweenManager } from './Tween';
import { AudioManager } from './Audio';
import { VFXPool } from './VFXPool';
import { RNG } from './RNG';
import { Analytics } from '../systems/analytics/Analytics';
import { ABConfig } from '../systems/abtest/ABConfig';
import type { IAdService } from '../systems/ads/IAdService';
import { MockAdService } from '../systems/ads/MockAdService';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { MergeBoardScene } from '../scenes/MergeBoardScene';
import { RoomViewEntranceHallScene } from '../scenes/RoomViewEntranceHallScene';
import { MatchMiniModeScene } from '../scenes/MatchMiniModeScene';
import { DevTestScene } from '../scenes/DevTestScene';

export interface GameContext {
  app: PIXI.Application;
  sceneManager: SceneManager;
  time: Time;
  tween: TweenManager;
  audio: AudioManager;
  vfx: VFXPool;
  rng: RNG;
  analytics: Analytics;
  abConfig: ABConfig;
  adService: IAdService;
}

export class Game {
  private readonly app: PIXI.Application;
  private readonly viewport = new PIXI.Container();
  private readonly sceneRoot = new PIXI.Container();
  private readonly vfxRoot = new PIXI.Container();
  private readonly time = new Time();
  private readonly tween = new TweenManager();
  private readonly audio = new AudioManager();
  private readonly analytics = new Analytics();
  private readonly abConfig = new ABConfig();
  private readonly adService: IAdService = new MockAdService();
  private readonly rng = new RNG();
  private readonly sceneManager: SceneManager;
  private readonly vfxPool: VFXPool;
  private readonly fpsText = new PIXI.Text('FPS 60', {
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 18,
    fill: 0xffffff,
  });
  private showFps = false;

  constructor(private readonly root: HTMLElement) {
    this.app = new PIXI.Application({
      width: 1080,
      height: 1920,
      antialias: true,
      backgroundColor: 0x0d1722,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    });

    this.root.appendChild(this.app.view as HTMLCanvasElement);
    this.root.style.margin = '0';
    this.root.style.padding = '0';
    this.root.style.width = '100vw';
    this.root.style.height = '100vh';
    this.root.style.overflow = 'hidden';

    this.app.stage.addChild(this.viewport);
    this.viewport.addChild(this.sceneRoot, this.vfxRoot);

    this.fpsText.position.set(980, 6);
    this.fpsText.visible = this.showFps;
    this.viewport.addChild(this.fpsText);

    this.vfxPool = new VFXPool(this.vfxRoot, 150);
    this.sceneManager = new SceneManager(this.sceneRoot);

    const context: GameContext = {
      app: this.app,
      sceneManager: this.sceneManager,
      time: this.time,
      tween: this.tween,
      audio: this.audio,
      vfx: this.vfxPool,
      rng: this.rng,
      analytics: this.analytics,
      abConfig: this.abConfig,
      adService: this.adService,
    };

    this.registerAudio();
    this.registerScenes(context);
    this.setupRuntime();
    this.resize();

    this.sceneManager.switchTo('main-menu');
    this.analytics.log('boot', {
      variant: this.abConfig.getVariant(),
      userId: this.abConfig.getUserId(),
    });
  }

  private registerAudio(): void {
    this.audio.register('click', '/assets/audio/click.wav', 4);
    this.audio.register('merge', '/assets/audio/merge.wav', 5);
    this.audio.register('success', '/assets/audio/success.wav', 4);
    this.audio.register('chime', '/assets/audio/chime.wav', 3);
    this.audio.register('legendary', '/assets/audio/legendary.wav', 2);
    this.audio.register('ambience', '/assets/audio/ambience.wav', 1);
  }

  private registerScenes(context: GameContext): void {
    this.sceneManager.register(new MainMenuScene(context));
    this.sceneManager.register(new MergeBoardScene(context));
    this.sceneManager.register(new RoomViewEntranceHallScene(context));
    this.sceneManager.register(new MatchMiniModeScene(context));
    this.sceneManager.register(new DevTestScene(context));
  }

  private setupRuntime(): void {
    this.app.ticker.add(() => {
      const deltaMs = this.time.update(this.app.ticker.deltaMS);
      this.tween.update(deltaMs);
      this.sceneManager.update(deltaMs);
      this.vfxPool.update(deltaMs);
      this.fpsText.text = `FPS ${Math.round(this.app.ticker.FPS)}`;
    });

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'f') {
        this.showFps = !this.showFps;
        this.fpsText.visible = this.showFps;
      }
    });
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(width / 1080, height / 1920);

    this.viewport.scale.set(scale);
    this.viewport.position.set((width - 1080 * scale) * 0.5, (height - 1920 * scale) * 0.5);
    this.sceneManager.resize(1080, 1920);

    const view = this.app.view as HTMLCanvasElement;
    view.style.width = `${width}px`;
    view.style.height = `${height}px`;
  }
}
