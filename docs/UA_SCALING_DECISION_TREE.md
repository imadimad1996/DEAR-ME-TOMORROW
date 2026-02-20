# UA Scaling Decision Tree

## Core Rule
- If `LTV/CPI < 1.3`: do not scale.
- If `1.3 <= LTV/CPI < 1.5`: cautious scale.
- If `LTV/CPI >= 1.5`: aggressive scale.

## Decision Path
1. Validate cohort quality (D1/D7/session time).
2. Check margin (`LTV/CPI`).
3. Check creative freshness.
4. Decide budget movement.

## Creative Fatigue Policy
- Replace ad creatives when CTR drops >30% from peak.
- Ship new creatives every 7-10 days minimum.
- Keep 3-5 active creative angles in rotation.
