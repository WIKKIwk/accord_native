import { WorkerPaddonRetired } from './workerPaddonModel';

/** Short-lived navigation reads; explicit refreshes always bypass a saved response. */
export class WorkerPaddonReadCache<T> {
  private data: T | null = null;
  private savedAt = 0;
  private generation = 0;
  private pending: { promise: Promise<T>; current(): boolean } | null = null;
  constructor(private readonly now: () => number = Date.now, private readonly maxAge = 15_000) {}
  peek(): T | null {
    const age = this.now() - this.savedAt;
    return this.data !== null && age >= 0 && age < this.maxAge ? this.data : null;
  }
  read(load: () => Promise<T>, current: () => boolean, force = true): Promise<T> {
    if (!current()) return Promise.reject(new WorkerPaddonRetired());
    const cached = this.peek();
    if (!force && cached !== null) return Promise.resolve(cached);
    const pending = this.pending;
    if (!force && pending?.current()) return pending.promise.then(data => {
      if (!current()) throw new WorkerPaddonRetired();
      return data;
    }, error => {
      // A shared request belongs to its first route. A new live route must not
      // inherit that route's cancellation when the user navigates quickly.
      if (current() && !pending.current()) return this.read(load, current, false);
      throw error;
    });
    if (force) this.data = null;
    const generation = ++this.generation;
    const valid = () => generation === this.generation && current();
    let promise: Promise<T>;
    promise = Promise.resolve().then(() => {
      if (!valid()) throw new WorkerPaddonRetired();
      return load();
    }).then(data => {
      if (!valid()) throw new WorkerPaddonRetired();
      this.data = data; this.savedAt = this.now();
      return data;
    }).catch(error => {
      if (generation === this.generation) this.data = null;
      throw error;
    }).finally(() => { if (this.pending?.promise === promise) this.pending = null; });
    this.pending = { promise, current: valid };
    return promise;
  }
  invalidate() { this.generation++; this.data = null; this.pending = null; }
}
