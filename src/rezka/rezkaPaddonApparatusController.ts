import type { AdminApparatus } from '../apparatusApi';
import { assignedPaddonApparatus } from './rezkaPaddonScope';

type State = { phase: 'loading' | 'ready' | 'invalid'; apparatus: AdminApparatus[] };

/** Unconnected drawer reader; it never opens a route or performs a write. */
export class RezkaPaddonApparatusController {
  private state: State = { phase: 'loading', apparatus: [] };
  private listeners = new Set<() => void>();
  private suspended = true;
  private retired = false;
  private disposed = false;
  private started = false;
  private pending: Promise<void> | null = null;
  private result: AdminApparatus[] | null = null;
  constructor(private readonly deps: { isCurrent(): boolean; assigned: readonly string[]; load(): Promise<AdminApparatus[]> }) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private current() { return !this.retired && !this.disposed && this.deps.isCurrent(); }
  private publish(state: State) {
    this.state = state;
    for (const listener of this.listeners) {
      try {
        const result: unknown = listener();
        if (result && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
      } catch { /* View subscribers must not interrupt reads or session invalidation. */ }
    }
  }
  resume() {
    this.suspended = false;
    if (!this.current()) this.invalidate();
    else if (this.result !== null) this.publish({ phase: 'ready', apparatus: this.result });
  }
  suspend() { this.suspended = true; }
  invalidate() {
    if (this.retired) return;
    this.retired = true; this.result = null; this.publish({ phase: 'invalid', apparatus: [] });
  }
  dispose() { this.disposed = true; this.invalidate(); this.listeners.clear(); }
  start(): Promise<void> {
    if (this.suspended) return Promise.resolve();
    if (!this.current()) { this.invalidate(); return Promise.resolve(); }
    if (this.started) return this.pending ?? Promise.resolve();
    this.started = true; this.pending = this.read(); return this.pending;
  }
  private async read() {
    let rows: AdminApparatus[] = [];
    // V2's drawer skips the catalog request only when the assignment list is empty.
    if (this.deps.assigned.length) {
      try { rows = await this.deps.load(); } catch { rows = []; }
    }
    if (!this.current()) { this.invalidate(); return; }
    this.result = assignedPaddonApparatus(rows, this.deps.assigned);
    if (!this.suspended) this.publish({ phase: 'ready', apparatus: this.result });
  }
}
