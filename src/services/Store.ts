export type Listener<T> = (state: T) => void;

export class Store<T> {
  private listeners = new Set<Listener<T>>();

  constructor(private state: T) {}

  public getState(): T {
    return this.state;
  }

  public setState(nextState: T): void {
    this.state = nextState;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public update(mutator: (draft: T) => T): void {
    this.setState(mutator(this.state));
  }

  public subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
