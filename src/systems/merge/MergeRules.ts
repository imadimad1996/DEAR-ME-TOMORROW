import type { Item } from './Item';

export function canMerge(a: Item, b: Item): boolean {
  if (a.uid === b.uid) {
    return false;
  }
  if (a.isJoker || b.isJoker) {
    const normal = a.isJoker ? b : a;
    return normal.tier < 8;
  }
  return a.chainId === b.chainId && a.tier === b.tier && a.tier < 8;
}

export function getMergeResult(a: Item, b: Item): { chainId: Item['chainId']; tier: number } {
  const normalA = a.isJoker ? b : a;
  const normalB = b.isJoker ? a : b;
  const chainId = normalA.chainId;
  const tier = Math.min(8, Math.max(normalA.tier, normalB.tier) + 1);
  return { chainId, tier };
}
