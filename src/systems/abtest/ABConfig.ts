import variantsRaw from './variants.default.json';
import { hashString } from '../../engine/RNG';

const AB_USER_KEY = 'dmt.ab.user';
const AB_VARIANT_KEY = 'dmt.ab.variant.v1';

export interface ABVariant {
  echoChance: number;
  rewardDelay: number;
  ctaGlowIntensity: 'low' | 'med' | 'high';
  starterPackPrice: number;
  energyRegenMinutes: number;
}

interface VariantsSource {
  echoChance: number[];
  rewardDelay: number[];
  ctaGlowIntensity: Array<'low' | 'med' | 'high'>;
  starterPackPrice: number[];
  energyRegenMinutes: number[];
}

export class ABConfig {
  private readonly variants = variantsRaw as VariantsSource;
  private readonly variant: ABVariant;
  private readonly userId: string;

  constructor() {
    this.userId = this.ensureUserId();
    this.variant = this.ensureVariant();
  }

  public getVariant(): ABVariant {
    return this.variant;
  }

  public getUserId(): string {
    return this.userId;
  }

  private ensureUserId(): string {
    const existing = localStorage.getItem(AB_USER_KEY);
    if (existing) {
      return existing;
    }
    const next = `u_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(AB_USER_KEY, next);
    return next;
  }

  private ensureVariant(): ABVariant {
    const persisted = localStorage.getItem(AB_VARIANT_KEY);
    if (persisted) {
      try {
        return JSON.parse(persisted) as ABVariant;
      } catch {
        // Continue with deterministic generation.
      }
    }

    const h = hashString(this.userId);
    const pick = <T>(items: T[], salt: number): T => {
      const index = Math.abs(h + salt) % items.length;
      return items[index];
    };

    const selected: ABVariant = {
      echoChance: pick(this.variants.echoChance, 11),
      rewardDelay: pick(this.variants.rewardDelay, 17),
      ctaGlowIntensity: pick(this.variants.ctaGlowIntensity, 23),
      starterPackPrice: pick(this.variants.starterPackPrice, 31),
      energyRegenMinutes: pick(this.variants.energyRegenMinutes, 43),
    };

    localStorage.setItem(AB_VARIANT_KEY, JSON.stringify(selected));
    return selected;
  }
}
