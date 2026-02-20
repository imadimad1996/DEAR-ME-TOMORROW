import * as PIXI from 'pixi.js';
import type { IScene } from '../engine/SceneManager';
import type { GameContext } from '../engine/Game';
import { UITheme } from '../ui/UITheme';
import { Button } from '../ui/Button';

export class MainMenuScene implements IScene {
  public readonly id = 'main-menu';
  public readonly container = new PIXI.Container();

  private readonly background = new PIXI.Graphics();
  private readonly logo = new PIXI.Text('Dear Me, Tomorrow', UITheme.text.title);
  private readonly subtitle = new PIXI.Text('Merge tiny miracles. Read letters from your future self.', {
    ...UITheme.text.small,
    fill: 0xe7f5ff,
  });
  private readonly startButton: Button;
  private readonly devButton: Button;
  private readonly matchButton: Button;

  constructor(private readonly ctx: GameContext) {
    this.startButton = new Button('Start Merge Story', () => {
      this.ctx.sceneManager.switchTo('merge-board');
    }, 380, 74);

    this.devButton = new Button('Dev Test Lab', () => {
      this.ctx.sceneManager.switchTo('dev-test');
    }, 320, 70);

    this.matchButton = new Button('Match Mini Mode', () => {
      this.ctx.sceneManager.switchTo('match-mini');
    }, 320, 70);

    this.build();
  }

  public enter(_previousSceneId: string | null): void {}

  public exit(_nextSceneId: string): void {}

  public resize(width: number, height: number): void {
    this.background.clear();
    const gradient = new PIXI.Graphics();
    gradient.beginFill(0x0f4c5c, 1).drawRect(0, 0, width, height).endFill();
    gradient.beginFill(0x102030, 0.72).drawRect(0, height * 0.4, width, height).endFill();

    this.background.removeChildren();
    this.background.addChild(gradient);
  }

  public update(deltaMs: number): void {
    const t = Date.now() / 1000;
    this.logo.scale.set(1 + Math.sin(t * 1.2) * 0.018);
    this.subtitle.y = 398 + Math.sin(t * 1.4) * 2;

    this.startButton.update(deltaMs);
    this.devButton.update(deltaMs);
    this.matchButton.update(deltaMs);
  }

  private build(): void {
    this.logo.anchor.set(0.5);
    this.logo.position.set(540, 300);
    this.logo.style.fill = [UITheme.colors.cream, UITheme.colors.gold];

    this.subtitle.anchor.set(0.5);
    this.subtitle.position.set(540, 398);

    this.startButton.container.position.set(350, 620);
    this.devButton.container.position.set(380, 730);
    this.matchButton.container.position.set(380, 820);

    const tips = new PIXI.Text('Tip: “You did a tiny miracle.” appears on every completed order.', {
      ...UITheme.text.small,
      fill: 0x9fe7ff,
    });
    tips.anchor.set(0.5);
    tips.position.set(540, 930);

    const logoGlow = PIXI.Sprite.from('/assets/marketing/key_art_poster.png');
    logoGlow.width = 620;
    logoGlow.height = 300;
    logoGlow.anchor.set(0.5);
    logoGlow.alpha = 0.18;
    logoGlow.position.set(540, 300);

    this.container.addChild(
      this.background,
      logoGlow,
      this.logo,
      this.subtitle,
      this.startButton.container,
      this.devButton.container,
      this.matchButton.container,
      tips,
    );
  }
}
