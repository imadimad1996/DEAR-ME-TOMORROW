import * as PIXI from 'pixi.js';
import type { IScene } from '../engine/SceneManager';
import type { GameContext } from '../engine/Game';
import { Button } from '../ui/Button';
import { CHAINS } from '../systems/merge/ChainsData';

export class DevTestScene implements IScene {
  public readonly id = 'dev-test';
  public readonly container = new PIXI.Container();

  private chainIndex = 0;
  private tier = 1;
  private readonly info = new PIXI.Text('', {
    fontFamily: 'Trebuchet MS, sans-serif',
    fontSize: 30,
    fill: 0xf6f1e9,
  });

  private readonly buttons: Button[] = [];

  constructor(private readonly ctx: GameContext) {
    this.build();
    this.refreshInfo();
  }

  public enter(_previousSceneId: string | null): void {}

  public exit(_nextSceneId: string): void {}

  public resize(_width: number, _height: number): void {}

  public update(deltaMs: number): void {
    this.buttons.forEach((button) => button.update(deltaMs));
  }

  private build(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x121e2a, 1).drawRect(0, 0, 1080, 1920).endFill();
    this.container.addChild(bg);

    const title = new PIXI.Text('Dev Test Scene', {
      fontFamily: 'Georgia, serif',
      fontSize: 56,
      fill: 0xf4c542,
    });
    title.anchor.set(0.5);
    title.position.set(540, 110);

    this.info.anchor.set(0.5);
    this.info.position.set(540, 260);

    this.container.addChild(title, this.info);

    this.makeButton('Back to Menu', 390, 340, () => this.ctx.sceneManager.switchTo('main-menu'), 300, 64);
    this.makeButton('Go Merge Board', 390, 420, () => this.ctx.sceneManager.switchTo('merge-board'), 300, 64);

    this.makeButton('Chain +', 260, 540, () => {
      this.chainIndex = (this.chainIndex + 1) % CHAINS.length;
      this.refreshInfo();
    }, 180, 56);

    this.makeButton('Tier +', 640, 540, () => {
      this.tier = this.tier >= 8 ? 1 : this.tier + 1;
      this.refreshInfo();
    }, 180, 56);

    this.makeButton('Spawn Selected', 390, 620, () => {
      const merge = this.ctx.sceneManager.getScene<any>('merge-board');
      merge?.debugSpawn?.(CHAINS[this.chainIndex].id, this.tier);
      this.ctx.sceneManager.switchTo('merge-board');
    }, 300, 64);

    this.makeButton('Trigger Legendary Cinematic', 300, 760, () => {
      const merge = this.ctx.sceneManager.getScene<any>('merge-board');
      merge?.triggerLegendaryCinematic?.();
      this.ctx.sceneManager.switchTo('merge-board');
    }, 480, 64);

    this.makeButton('Trigger Room Reveal', 330, 840, () => {
      const merge = this.ctx.sceneManager.getScene<any>('merge-board');
      merge?.triggerRoomRevealCinematic?.();
      this.ctx.sceneManager.switchTo('merge-board');
    }, 420, 64);

    this.makeButton('Trigger Echo Cinematic Stub', 300, 920, () => {
      const merge = this.ctx.sceneManager.getScene<any>('merge-board');
      merge?.triggerEchoChoiceCinematicStub?.();
      this.ctx.sceneManager.switchTo('merge-board');
    }, 480, 64);

    this.makeButton('Simulate Rewarded Ad', 330, 1000, () => {
      const merge = this.ctx.sceneManager.getScene<any>('merge-board');
      merge?.simulateRewardedAd?.();
      this.ctx.sceneManager.switchTo('merge-board');
    }, 420, 64);

    this.makeButton('Export Analytics JSON', 330, 1080, () => {
      this.ctx.analytics.downloadJSON('dear-me-tomorrow-analytics.json');
    }, 420, 64);

    this.makeButton('Open Room View Scene', 330, 1160, () => {
      this.ctx.sceneManager.switchTo('room-entrance-hall');
    }, 420, 64);
  }

  private refreshInfo(): void {
    this.info.text = `Selected: ${CHAINS[this.chainIndex].displayName} / Tier ${this.tier}`;
  }

  private makeButton(
    label: string,
    x: number,
    y: number,
    onClick: () => void,
    width = 320,
    height = 64,
  ): void {
    const button = new Button(label, onClick, width, height);
    button.container.position.set(x, y);
    this.buttons.push(button);
    this.container.addChild(button.container);
  }
}
