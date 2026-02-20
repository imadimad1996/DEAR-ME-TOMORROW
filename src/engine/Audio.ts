export class AudioManager {
  private pools = new Map<string, HTMLAudioElement[]>();
  private masterVolume = 0.75;

  public register(key: string, url: string, poolSize = 4): void {
    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < poolSize; i += 1) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      pool.push(audio);
    }
    this.pools.set(key, pool);
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  public play(key: string, volume = 1): void {
    const pool = this.pools.get(key);
    if (!pool || pool.length === 0) {
      return;
    }
    const audio = pool.find((entry) => entry.paused) ?? pool[0];
    try {
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, volume * this.masterVolume));
      void audio.play();
    } catch {
      // Ignore autoplay restrictions during development.
    }
  }
}
