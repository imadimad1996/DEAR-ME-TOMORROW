# Economy & Tuning

## Baseline
- Spawn cost: 1 energy
- Max energy: 40
- Orders active: 5
- Initial currencies: coins 120 / gems 25 / stars 0

## A/B Variant Inputs
Source: `src/systems/abtest/variants.default.json`

- `echoChance`: 0.08 / 0.10 / 0.12
- `rewardDelay`: 0.3 / 0.5
- `ctaGlowIntensity`: low / med / high
- `starterPackPrice`: 1.99 / 2.99 (stub)
- `energyRegenMinutes`: 2.0 / 1.8

## How to Test Variants
1. Clear `localStorage` keys `dmt.ab.user` and `dmt.ab.variant.v1`.
2. Reload app to force deterministic reassignment.
3. Inspect console `boot` event payload for selected variant.
