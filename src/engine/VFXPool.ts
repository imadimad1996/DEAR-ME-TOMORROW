import * as PIXI from 'pixi.js';
import { clamp } from '../utils/clamp';

interface Particle {
  sprite: PIXI.Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class VFXPool {
  private readonly particles: Particle[] = [];
  private readonly pool: PIXI.Sprite[] = [];

  constructor(
    private readonly container: PIXI.Container,
    private readonly maxParticles = 150,
  ) {}

  public burst(
    x: number,
    y: number,
    color: number,
    count: number,
    spread = 40,
    lifeMs = 600,
  ): void {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= this.maxParticles) {
        break;
      }
      const sprite = this.pool.pop() ?? PIXI.Sprite.from(PIXI.Texture.WHITE);
      sprite.width = 6;
      sprite.height = 6;
      sprite.anchor.set(0.5);
      sprite.tint = color;
      sprite.alpha = 1;
      sprite.position.set(x, y);
      this.container.addChild(sprite);

      const angle = (Math.PI * 2 * i) / Math.max(1, count);
      const speed = spread * (0.6 + Math.random() * 0.7);
      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: lifeMs,
        maxLife: lifeMs,
      });
    }
  }

  public update(deltaMs: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= deltaMs;
      particle.sprite.x += (particle.vx * deltaMs) / 1000;
      particle.sprite.y += (particle.vy * deltaMs) / 1000;
      particle.vy += 8 * (deltaMs / 16.67);
      particle.sprite.alpha = clamp(particle.life / particle.maxLife, 0, 1);
      if (particle.life <= 0) {
        particle.sprite.removeFromParent();
        this.pool.push(particle.sprite);
        this.particles.splice(i, 1);
      }
    }
  }
}
