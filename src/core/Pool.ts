export interface Poolable {
  active: boolean;
}

/**
 * Fixed-capacity object pool.
 *
 * Everything is built up front and reused, so steady-state play never allocates and never
 * triggers a collection pause mid-dogfight. Acquire and release are both constant time via
 * a free stack; `items` is exposed directly so hot loops can iterate with a plain indexed
 * `for` and skip inactive entries without a callback per element.
 */
export class Pool<T extends Poolable> {
  readonly items: T[] = [];
  private readonly free: T[] = [];

  constructor(capacity: number, factory: () => T) {
    for (let i = 0; i < capacity; i += 1) {
      const item = factory();
      item.active = false;
      this.items.push(item);
      this.free.push(item);
    }
  }

  /** Returns an inactive item, or null when the pool is exhausted. */
  acquire(): T | null {
    const item = this.free.pop();
    if (!item) {
      return null;
    }
    item.active = true;
    return item;
  }

  release(item: T): void {
    if (!item.active) {
      return;
    }
    item.active = false;
    this.free.push(item);
  }

  releaseAll(): void {
    this.free.length = 0;
    for (const item of this.items) {
      item.active = false;
      this.free.push(item);
    }
  }

  get activeCount(): number {
    return this.items.length - this.free.length;
  }
}
