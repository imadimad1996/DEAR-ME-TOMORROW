import type { IAdService, RewardedResult } from './IAdService';

export class MockAdService implements IAdService {
  public async showRewarded(): Promise<RewardedResult> {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 1200);
    });
    const completed = Math.random() > 0.08;
    return { completed };
  }
}
