import * as PIXI from 'pixi.js';

interface Dust {
  sprite: PIXI.Graphics;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
}

export class RoomLighting {
  public readonly container = new PIXI.Container();
  private readonly tintOverlay = new PIXI.Graphics();
  private readonly ray = PIXI.Sprite.from('/assets/echo/echo_aura_frame.png');
  private dusts: Dust[] = [];
  private elapsed = 0;

  constructor(private readonly width: number, private readonly height: number) {
    this.tintOverlay.beginFill(0xfff4d6, 0.08).drawRect(0, 0, width, height).endFill();

    this.ray.anchor.set(0.5);
    this.ray.width = width * 1.2;
    this.ray.height = height * 0.8;
    this.ray.position.set(width * 0.5, height * 0.35);
    this.ray.alpha = 0.08;
    this.ray.tint = 0xffefc8;

    this.container.addChild(this.tintOverlay, this.ray);
    this.ensureDust(8);
  }

  public update(deltaMs: number): void {
    this.elapsed += deltaMs;

    const flicker = 1 + Math.sin(this.elapsed / 3000) * 0.02;
    const tempShift = 1 + Math.cos(this.elapsed / 3200) * 0.03;
    this.container.alpha = 0.86 * flicker;
    this.ray.alpha = 0.07 + Math.sin(this.elapsed / 10000 * Math.PI * 2) * 0.03;
    this.tintOverlay.tint = tempShift > 1 ? 0xfff3d1 : 0xf2ebff;

    this.dusts.forEach((dust) => {
      dust.lifeMs -= deltaMs;
      dust.sprite.x += dust.vx * (deltaMs / 1000);
      dust.sprite.y += dust.vy * (deltaMs / 1000);
      dust.sprite.alpha = Math.max(0, Math.min(0.5, dust.lifeMs / dust.maxLifeMs));
      if (dust.lifeMs <= 0) {
        this.resetDust(dust);
      }
    });
  }

  private ensureDust(count: number): void {
    while (this.dusts.length < count) {
      const g = new PIXI.Graphics();
      g.beginFill(0xffffff, 0.35).drawCircle(0, 0, 2).endFill();
      this.container.addChild(g);
      const dust: Dust = {
        sprite: g,
        vx: 0,
        vy: 0,
        lifeMs: 0,
        maxLifeMs: 0,
      };
      this.dusts.push(dust);
      this.resetDust(dust);
    }
  }

  private resetDust(dust: Dust): void {
    dust.sprite.position.set(Math.random() * this.width, Math.random() * this.height * 0.75);
    dust.vx = (Math.random() - 0.5) * 4;
    dust.vy = -2 - Math.random() * 3;
    dust.maxLifeMs = 15000 + Math.random() * 5000;
    dust.lifeMs = dust.maxLifeMs;
    dust.sprite.alpha = 0.35;
  }
}
