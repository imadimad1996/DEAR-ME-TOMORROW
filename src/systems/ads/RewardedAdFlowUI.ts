import * as PIXI from 'pixi.js';
import type { IAdService } from './IAdService';
import { Button } from '../../ui/Button';
import { UITheme } from '../../ui/UITheme';

export class RewardedAdFlowUI {
  public readonly container = new PIXI.Container();
  private readonly dim = new PIXI.Graphics();
  private readonly card = new PIXI.Graphics();
  private readonly message = new PIXI.Text('Just one more merge?', {
    ...UITheme.text.body,
    fill: 0xf6f1e9,
    align: 'center',
  });
  private onComplete: ((completed: boolean) => void) | null = null;

  constructor(private readonly adService: IAdService) {
    this.container.visible = false;
    this.dim.beginFill(0x000000, 0.15).drawRect(0, 0, 1080, 1920).endFill();
    this.dim.alpha = 1;

    this.card.beginFill(0x1f2f3f, 0.96).drawRoundedRect(0, 0, 760, 520, 26).endFill();
    this.card.lineStyle(3, 0xf4c542, 0.9).drawRoundedRect(0, 0, 760, 520, 26);
    this.card.position.set(160, 700);

    this.message.anchor.set(0.5);
    this.message.position.set(540, 840);

    const watchButton = new Button('Watch Rewarded', () => {
      void this.watch();
    });
    watchButton.container.position.set(390, 980);

    const cancelButton = new Button('Later', () => {
      this.hide(false);
    });
    cancelButton.container.position.set(430, 1080);

    this.container.addChild(this.dim, this.card, this.message, watchButton.container, cancelButton.container);
  }

  public resize(width: number, height: number): void {
    this.dim.clear();
    this.dim.beginFill(0x000000, 0.55).drawRect(0, 0, width, height).endFill();
  }

  public show(onComplete: (completed: boolean) => void): void {
    this.onComplete = onComplete;
    this.container.visible = true;
  }

  public hide(completed: boolean): void {
    this.container.visible = false;
    this.onComplete?.(completed);
    this.onComplete = null;
  }

  private async watch(): Promise<void> {
    const result = await this.adService.showRewarded();
    this.hide(result.completed);
  }
}
