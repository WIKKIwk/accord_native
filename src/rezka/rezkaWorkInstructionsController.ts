import type { AdminApparatus } from '../apparatusApi';
import { assignedInstructionApparatus } from './rezkaWorkInstructionsModel';

type State = { phase: 'loading' | 'ready' | 'invalid'; apparatus: AdminApparatus[] };

/** One V2 initState read. A failed read deliberately has the same empty state as no assignment. */
export class RezkaWorkInstructionsController {
  private state: State = { phase: 'loading', apparatus: [] };
  private listeners = new Set<() => void>();
  private suspended = true;
  private retired = false;
  private disposed = false;
  private pending: Promise<void> | null = null;
  private started = false;
  private result: AdminApparatus[] | null = null;
  constructor(private readonly deps: { isCurrent(): boolean; assigned: readonly string[]; load(): Promise<AdminApparatus[]> }) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private current() { return !this.retired && !this.disposed && this.deps.isCurrent(); }
  private publish(state: State) { this.state = state; this.listeners.forEach(listener => listener()); }
  resume() {
    this.suspended = false;
    if (!this.current()) this.invalidate();
    else if (this.result !== null) this.publish({ phase: 'ready', apparatus: this.result });
  }
  suspend() { this.suspended = true; }
  invalidate() { this.retired = true; this.result = null; this.publish({ phase: 'invalid', apparatus: [] }); }
  dispose() { this.disposed = true; this.invalidate(); this.listeners.clear(); }
  start(): Promise<void> {
    if (this.suspended || !this.current()) return Promise.resolve();
    if (this.started) return this.pending ?? Promise.resolve();
    this.started = true; this.pending = this.read(); return this.pending;
  }
  private async read() {
    let rows: AdminApparatus[];
    try { rows = await this.deps.load(); } catch { rows = []; }
    if (!this.current()) { this.invalidate(); return; }
    this.result = assignedInstructionApparatus(rows, this.deps.assigned);
    if (!this.suspended) this.publish({ phase: 'ready', apparatus: this.result });
  }
}
