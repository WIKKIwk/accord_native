import type { RezkaPaddonDetailOwner } from './rezkaPaddonDetailLifetime';
import type { RezkaPaddonDetailBinding, RezkaPaddonDetailReadControl } from './rezkaPaddonDetailRead';

export type RezkaPaddonDetailState = Readonly<{ phase: 'loading' | 'ready' | 'error' | 'invalid';
  binding: RezkaPaddonDetailBinding | null; refreshing: boolean }>;
type Dependencies = { isCurrent(): boolean; createOwner(): RezkaPaddonDetailOwner; ownerCurrent(owner: RezkaPaddonDetailOwner): boolean;
  subscribeOwner(owner: RezkaPaddonDetailOwner, listener: () => void): () => void;
  load(owner: RezkaPaddonDetailOwner, control: RezkaPaddonDetailReadControl): Promise<RezkaPaddonDetailBinding>;
  accept(binding: RezkaPaddonDetailBinding): boolean };

function consumeAsync(value: unknown) {
  if (value && (typeof value === 'object' || typeof value === 'function')) void Promise.resolve(value).catch(() => {});
}
function syncTrue(check: () => boolean): boolean {
  try { const result: unknown = check(); if (result === true) return true; consumeAsync(result); } catch { /* Fail closed. */ }
  return false;
}

/** Unconnected read-only lifecycle. It never opens a route or performs a Paddon mutation. */
export class RezkaPaddonDetailController {
  private state: RezkaPaddonDetailState = { phase: 'loading', binding: null, refreshing: false };
  private listeners = new Set<() => void>();
  private waiters = new Set<() => void>();
  private owner: RezkaPaddonDetailOwner | null = null;
  private unwatchOwner: (() => void) | null = null;
  private suspended = true;
  private retired = false;
  private disposed = false;
  private started = false;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private deferred: { generation: number; state: RezkaPaddonDetailState } | null = null;
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  private current() {
    const owner = this.owner;
    return !this.retired && !this.disposed && !!owner && syncTrue(() => this.deps.isCurrent()) &&
      syncTrue(() => this.deps.ownerCurrent(owner)) && !this.retired && !this.disposed && this.owner === owner;
  }
  private wake() { const waiters = [...this.waiters]; this.waiters.clear(); waiters.forEach(resolve => resolve()); }
  private publish(state: RezkaPaddonDetailState) {
    this.state = state;
    for (const listener of this.listeners) {
      try {
        const result: unknown = listener();
        if (result && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
      } catch { /* A view subscriber cannot interrupt retirement or a read. */ }
    }
  }
  private valid(generation: number) {
    if (!this.current()) { this.invalidate(); return false; }
    return generation === this.generation;
  }
  private async waitForResume(generation: number) {
    while (this.suspended && this.valid(generation)) await new Promise<void>(resolve => this.waiters.add(resolve));
    return this.valid(generation);
  }
  private finish(generation: number, state: RezkaPaddonDetailState) {
    if (!this.valid(generation)) return;
    if (this.suspended) this.deferred = { generation, state }; else this.publish(state);
  }
  resume() {
    if (this.retired || this.disposed) return;
    if (!this.owner) {
      try {
        if (!syncTrue(() => this.deps.isCurrent()) || this.retired || this.disposed) { this.invalidate(); return; }
        const candidate: unknown = this.deps.createOwner();
        if (!candidate || typeof candidate !== 'object' || typeof (candidate as RezkaPaddonDetailOwner).close !== 'function') {
          consumeAsync(candidate); throw new Error('Detail owner unavailable');
        }
        const owner = candidate as RezkaPaddonDetailOwner;
        if (this.retired || this.disposed) { consumeAsync(owner.close()); return; }
        this.owner = owner;
        const subscription: unknown = this.deps.subscribeOwner(owner, () => this.invalidate());
        if (typeof subscription !== 'function') { consumeAsync(subscription); throw new Error('Detail subscription unavailable'); }
        const unwatch = subscription as () => void;
        if (this.owner !== owner || this.retired || this.disposed) { consumeAsync(unwatch()); consumeAsync(owner.close()); return; }
        this.unwatchOwner = unwatch;
      } catch { this.invalidate(); return; }
    }
    this.suspended = false;
    if (!this.current()) this.invalidate();
    else if (this.deferred?.generation === this.generation) {
      const result = this.deferred.state; this.deferred = null; this.publish(result);
    }
    this.wake();
  }
  suspend() { this.suspended = true; }
  invalidate() {
    if (this.retired) return;
    this.retired = true; this.generation++; this.deferred = null; this.wake();
    const owner = this.owner; this.owner = null;
    try { consumeAsync(this.unwatchOwner?.()); } catch { /* Continue closing the owner. */ }
    this.unwatchOwner = null;
    try { consumeAsync(owner?.close()); } catch { /* Retirement and redaction must continue. */ }
    this.publish({ phase: 'invalid', binding: null, refreshing: false });
  }
  dispose() { this.disposed = true; this.invalidate(); this.listeners.clear(); }
  start(): Promise<void> {
    if (this.suspended) return Promise.resolve();
    if (!this.current()) { this.invalidate(); return Promise.resolve(); }
    if (this.started) return this.pending ?? Promise.resolve();
    this.started = true; return this.begin(false);
  }
  refresh(): Promise<void> {
    if (this.suspended) return Promise.resolve();
    if (!this.current()) { this.invalidate(); return Promise.resolve(); }
    this.started = true; return this.begin(true);
  }
  private begin(refresh: boolean): Promise<void> {
    const generation = ++this.generation; this.deferred = null; this.wake();
    // Schedule before publication so reentrant refresh supersedes this attempt.
    const pending = Promise.resolve().then(() => this.read(generation)); this.pending = pending;
    this.publish(refresh && this.state.phase === 'ready' ? { ...this.state, refreshing: true }
      : { phase: 'loading', binding: null, refreshing: false });
    return pending;
  }
  private async read(generation: number) {
    if (!(await this.waitForResume(generation))) return;
    const owner = this.owner;
    if (!owner || !this.valid(generation)) return;
    const control: RezkaPaddonDetailReadControl = { isCurrent: () => this.valid(generation),
      canSend: () => !this.suspended && this.valid(generation),
      waitForSend: async () => { if (!(await this.waitForResume(generation))) throw new Error('Detail read retired'); } };
    try {
      const binding = await this.deps.load(owner, control);
      if (!this.valid(generation)) return;
      if (!syncTrue(() => this.deps.accept(binding))) throw new Error('Detail binding unavailable');
      this.finish(generation, { phase: 'ready', binding, refreshing: false });
    } catch {
      if (!this.valid(generation)) return;
      this.finish(generation, { phase: 'error', binding: null, refreshing: false });
    }
  }
}
