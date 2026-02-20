import configJson from '../data/json/remoteConfig.json';
import type { RemoteConfig } from '../types/content';

export class RemoteConfigService {
  private config: RemoteConfig = structuredClone(configJson) as RemoteConfig;

  public get(): RemoteConfig {
    return this.config;
  }

  public async refresh(): Promise<RemoteConfig> {
    const response = await fetch('/src/data/json/remoteConfig.json', { cache: 'no-store' }).catch(() => null);
    if (response && response.ok) {
      const data = (await response.json()) as RemoteConfig;
      this.config = data;
      return this.config;
    }
    this.config = structuredClone(configJson) as RemoteConfig;
    return this.config;
  }
}
