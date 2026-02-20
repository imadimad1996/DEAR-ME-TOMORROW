import type { Item } from './Item';
import { canMerge } from './MergeRules';

export function findMagnetCandidate(items: Item[], source: Item, thresholdPx = 20): Item | null {
  let best: Item | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const item of items) {
    if (item.uid === source.uid) {
      continue;
    }
    if (!canMerge(source, item)) {
      continue;
    }
    const dx = item.sprite.x - source.sprite.x;
    const dy = item.sprite.y - source.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= thresholdPx && dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }

  return best;
}
