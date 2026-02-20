import * as PIXI from 'pixi.js';
import type { IScene } from '../engine/SceneManager';
import type { GameContext } from '../engine/Game';
import { Button } from '../ui/Button';
import { Parallax } from '../systems/rooms/Parallax';
import { RoomLighting } from '../systems/rooms/RoomLighting';

export class RoomViewEntranceHallScene implements IScene {
  public readonly id = 'room-entrance-hall';
  public readonly container = new PIXI.Container();

  private readonly parallax = new Parallax();
  private readonly lighting = new RoomLighting(1080, 1920);
  private readonly backButton: Button;
  private readonly revealButton: Button;
  private readonly title = new PIXI.Text('Entrance Hall', {
    fontFamily: 'Georgia, serif',
    fontSize: 52,
    fill: 0xf6f1e9,
  });

  constructor(private readonly ctx: GameContext) {
    this.backButton = new Button('Back', () => this.ctx.sceneManager.switchTo('merge-board'), 160, 60);
    this.revealButton = new Button('Play Reveal', () => {
      const mergeScene = this.ctx.sceneManager.getScene<any>('merge-board');
      mergeScene?.triggerRoomRevealCinematic?.();
    }, 240, 60);

    this.setupLayers();
    this.build();
  }

  public enter(_previousSceneId: string | null): void {}

  public exit(_nextSceneId: string): void {}

  public resize(_width: number, _height: number): void {}

  public update(deltaMs: number): void {
    this.parallax.update(deltaMs);
    this.lighting.update(deltaMs);
    this.backButton.update(deltaMs);
    this.revealButton.update(deltaMs);

    const t = Date.now() / 1000;
    this.title.alpha = 0.8 + Math.sin(t * 1.5) * 0.2;
  }

  private setupLayers(): void {
    this.parallax.addLayer('/assets/rooms/entrance_hall/classic_before.png', 0.2, 1080, 1920);
    this.parallax.addLayer('/assets/rooms/entrance_hall/modern_before.png', 0.4, 1080, 1920);
    this.parallax.addLayer('/assets/rooms/entrance_hall/future_before.png', 0.7, 1080, 1920);

    this.container.eventMode = 'static';
    this.container.hitArea = new PIXI.Rectangle(0, 0, 1080, 1920);
    this.container.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      const nx = ((event.globalX / 1080) - 0.5) * 6;
      const ny = ((event.globalY / 1920) - 0.5) * 4;
      this.parallax.setDragOffset(nx, ny);
    });
    this.container.on('pointerup', () => this.parallax.release());
    this.container.on('pointerupoutside', () => this.parallax.release());
  }

  private build(): void {
    this.title.anchor.set(0.5);
    this.title.position.set(540, 110);
    this.backButton.container.position.set(40, 40);
    this.revealButton.container.position.set(800, 40);

    this.container.addChild(
      this.parallax.container,
      this.lighting.container,
      this.title,
      this.backButton.container,
      this.revealButton.container,
    );
  }
}
