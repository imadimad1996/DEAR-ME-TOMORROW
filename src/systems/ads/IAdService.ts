export interface RewardedResult {
  completed: boolean;
}

export interface IAdService {
  showRewarded(): Promise<RewardedResult>;
}
