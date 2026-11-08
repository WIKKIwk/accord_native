import type { AdminApparatus } from '../apparatusApi';
import { assignedPaddonApparatus, resolveRezkaPaddonScope, rezkaPaddonList, type RezkaPaddon } from './rezkaPaddonScope';

type Scope = ReturnType<typeof resolveRezkaPaddonScope>;
export type RezkaPaddonListState = { phase: 'loading' | 'ready' | 'error' | 'invalid' | 'unavailable'; refreshing: boolean;
  options: AdminApparatus[]; scope: Scope; paddons: RezkaPaddon[]; paddonCount: number; wipCount: number };

/** Unconnected read-only controller; it never changes a Paddon or opens a route. */
export class RezkaPaddonListController {
  private state: RezkaPaddonListState;
  private scope: Scope;
  private listeners = new Set<() => void>();
  private waiters = new Set<() => void>();
  private suspended = true;
  private retired = false;
  private disposed = false;
  private started = false;
  private generation = 0;
  private pending: Promise<void> | null = null;
  private deferred: { generation: number; state: RezkaPaddonListState } | null = null;
  constructor(private readonly deps: { isCurrent(): boolean; assigned: readonly string[]; routeId: string; routeName: string;
    loadApparatus(): Promise<AdminApparatus[]>; loadPaddons(apparatus: string): Promise<RezkaPaddon[]> }) {
    this.scope = resolveRezkaPaddonScope([], deps.routeId, deps.routeName);
    this.state = { phase: 'loading', refreshing: false, options: [], scope: this.scope, paddons: [], paddonCount: 0, wipCount: 0 };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private current() { return !this.retired && !this.disposed && this.deps.isCurrent(); }
  private wake() { const waiters = [...this.waiters]; this.waiters.clear(); waiters.forEach(resolve => resolve()); }
  private publish(state: RezkaPaddonListState) { this.state = state; this.listeners.forEach(listener => listener()); }
  private valid(generation: number) {
    if (!this.current()) { this.invalidate(); return false; }
    return generation === this.generation;
  }
  private async waitForResume(generation: number) {
    while (this.suspended && this.valid(generation)) await new Promise<void>(resolve => this.waiters.add(resolve));
    return this.valid(generation);
  }
  private finish(generation: number, state: RezkaPaddonListState) {
    if (!this.valid(generation)) return;
    if (this.suspended) this.deferred = { generation, state }; else this.publish(state);
  }
  resume() {
    this.suspended = false;
    if (!this.current()) this.invalidate();
    else if (this.deferred?.generation === this.generation) { const result = this.deferred.state; this.deferred = null; this.publish(result); }
    this.wake();
  }
  suspend() { this.suspended = true; }
  invalidate() {
    if (this.retired) return;
    this.retired = true; this.generation++; this.deferred = null; this.scope = resolveRezkaPaddonScope([]); this.wake();
    this.publish({ phase: 'invalid', refreshing: false, options: [], scope: this.scope, paddons: [], paddonCount: 0, wipCount: 0 });
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
    // Queue the read before publishing, so a reentrant refresh cannot start an older request.
    const pending = Promise.resolve().then(() => this.read(generation)); this.pending = pending;
    this.publish(refresh && this.state.phase === 'ready' ? { ...this.state, refreshing: true }
      : { ...this.state, phase: 'loading', refreshing: false });
    return pending;
  }
  private async read(generation: number) {
    while (this.suspended) if (!(await this.waitForResume(generation))) return;
    if (!this.valid(generation)) return;
    try {
      const catalog = await this.deps.loadApparatus();
      while (this.suspended) if (!(await this.waitForResume(generation))) return;
      if (!this.valid(generation)) return;
      const options = assignedPaddonApparatus(catalog, this.deps.assigned);
      const scope = resolveRezkaPaddonScope(options, this.scope.apparatusId, this.scope.apparatusName);
      // V2's route text is not an authorization decision. Never load a supplied ID outside the current active assigned cutters.
      if (scope.apparatusId && !options.some(item => item.id === scope.apparatusId)) {
        this.finish(generation, { phase: 'unavailable', refreshing: false, options: [], scope: resolveRezkaPaddonScope([]),
          paddons: [], paddonCount: 0, wipCount: 0 }); return;
      }
      const rows = scope.needsApparatus ? [] : await this.deps.loadPaddons(scope.apparatusId);
      if (!this.valid(generation)) return;
      this.scope = scope;
      this.finish(generation, { phase: 'ready', refreshing: false, options, scope, ...rezkaPaddonList(rows, scope.apparatusId) });
    } catch {
      if (!this.valid(generation)) return;
      this.finish(generation, { ...this.state, phase: 'error', refreshing: false, options: [], paddons: [], paddonCount: 0, wipCount: 0 });
    }
  }
}
