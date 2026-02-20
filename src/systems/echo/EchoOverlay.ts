import * as PIXI from 'pixi.js';
import type { Item } from '../merge/Item';

interface EchoVisual {
  ring: PIXI.Sprite;
  aura: PIXI.Sprite;
  particles: PIXI.Sprite[];
}

export class EchoOverlay {
  public readonly container = new PIXI.Container();
  private visuals = new Map<string, EchoVisual>();

  constructor() {
    this.container.sortableChildren = true;
  }

  public sync(items: Item[]): void {
    const itemMap = new Map(items.map((item) => [item.uid, item]));

    Array.from(this.visuals.keys()).forEach((id) => {
      if (!itemMap.has(id)) {
        const visual = this.visuals.get(id);
        if (visual) {
          visual.ring.removeFromParent();
          visual.aura.removeFromParent();
          visual.particles.forEach((p) => p.removeFromParent());
        }
        this.visuals.delete(id);
      }
    });

    items.forEach((item) => {
      if (!item.echo) {
        const visual = this.visuals.get(item.uid);
        if (visual) {
          visual.ring.removeFromParent();
          visual.aura.removeFromParent();
          visual.particles.forEach((p) => p.removeFromParent());
          this.visuals.delete(item.uid);
        }
        return;
      }

      if (!this.visuals.has(item.uid)) {
        const ring = PIXI.Sprite.from('/assets/echo/echo_slot_ui.png');
        ring.anchor.set(0.5);
        ring.width = item.sprite.width + 22;
        ring.height = item.sprite.height + 22;
        ring.alpha = 0.72;

        const aura = PIXI.Sprite.from('/assets/echo/echo_aura_frame.png');
        aura.anchor.set(0.5);
        aura.width = item.sprite.width + 14;
        aura.height = item.sprite.height + 14;
        aura.alpha = 0.68;

        const particles: PIXI.Sprite[] = [];
        for (let i = 0; i < 8; i += 1) {
          const particle = PIXI.Sprite.from('/assets/echo/echo_particles_sheet.png');
          particle.anchor.set(0.5);
          particle.width = 8;
          particle.height = 8;
          particle.alpha = 0.8;
          particles.push(particle);
          this.container.addChild(particle);
        }

        this.container.addChild(ring, aura);
        this.visuals.set(item.uid, { ring, aura, particles });
      }
    });
  }

  public update(items: Item[], elapsedMs: number): void {
    items.forEach((item) => {
      const visual = this.visuals.get(item.uid);
      if (!visual || !item.echo) {
        return;
      }

      const t = elapsedMs / 1000;
      visual.ring.position.set(item.sprite.x, item.sprite.y);
      visual.ring.rotation = (t * Math.PI * 2) / 5;
      visual.ring.zIndex = item.sprite.zIndex - 1;

      visual.aura.position.set(item.sprite.x, item.sprite.y);
      visual.aura.alpha = 0.55 + Math.sin((elapsedMs + item.x * 20) / 250) * 0.2;
      visual.aura.zIndex = item.sprite.zIndex;

      visual.particles.forEach((particle, index) => {
        const phase = t * 1.7 + index * (Math.PI * 2 / 8);
        particle.position.set(
          item.sprite.x + Math.cos(phase) * 30,
          item.sprite.y + Math.sin(phase) * 18,
        );
        particle.alpha = 0.45 + Math.sin(phase * 2) * 0.25;
      });
    });
  }
}
