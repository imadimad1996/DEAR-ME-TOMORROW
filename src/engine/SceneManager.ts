import * as PIXI from 'pixi.js';

export interface IScene {
  id: string;
  container: PIXI.Container;
  enter(previousSceneId: string | null): void;
  exit(nextSceneId: string): void;
  update(deltaMs: number): void;
  resize(width: number, height: number): void;
}

export class SceneManager {
  private scenes = new Map<string, IScene>();
  private current: IScene | null = null;

  constructor(private readonly root: PIXI.Container) {}

  public register(scene: IScene): void {
    this.scenes.set(scene.id, scene);
  }

  public getScene<T extends IScene>(id: string): T | null {
    return (this.scenes.get(id) as T | undefined) ?? null;
  }

  public switchTo(id: string): void {
    const next = this.scenes.get(id);
    if (!next) {
      return;
    }

    const previousId = this.current?.id ?? null;
    if (this.current) {
      this.current.exit(id);
      this.current.container.removeFromParent();
    }

    this.current = next;
    this.root.addChild(next.container);
    next.enter(previousId);
  }

  public update(deltaMs: number): void {
    this.current?.update(deltaMs);
  }

  public resize(width: number, height: number): void {
    this.scenes.forEach((scene) => scene.resize(width, height));
  }

  public get currentId(): string | null {
    return this.current?.id ?? null;
  }
}
