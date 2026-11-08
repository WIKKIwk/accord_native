import type { AdminApparatus } from '../apparatusApi';
import { AdminWorkMapController, type AdminWorkMapPage, type AdminWorkMapRequest, type AdminWorkMapState } from './adminWorkMapController';
import { adminWorkMapMoveDefaults } from './adminWorkMapMoveModel';

export type AdminWorkMapMoveState = { top: AdminApparatus | null; bottom: AdminApparatus | null;
  topWindow: AdminWorkMapState; bottomWindow: AdminWorkMapState };
type Dependencies = { isCurrent: () => boolean; read: (request: AdminWorkMapRequest & { search: string; cursor?: string | null }) => Promise<AdminWorkMapPage | null> };
/** Read-only opposite windows. No selection, drag, command, transfer or acknowledgement API exists here. */
export class AdminWorkMapMoveController {
  readonly topWindow: AdminWorkMapController;
  readonly bottomWindow: AdminWorkMapController;
  private state: AdminWorkMapMoveState;
  private listeners = new Set<() => void>();
  private active = false;
  private disposed = false;
  private batching = false;
  private stop: (() => void)[];
  constructor(private readonly deps: Dependencies) {
    this.topWindow = new AdminWorkMapController({ ...deps, request: null });
    this.bottomWindow = new AdminWorkMapController({ ...deps, request: null });
    this.state = { top: null, bottom: null, topWindow: this.topWindow.getSnapshot(), bottomWindow: this.bottomWindow.getSnapshot() };
    this.stop = [this.topWindow.subscribe(() => this.publish({ topWindow: this.topWindow.getSnapshot() })),
      this.bottomWindow.subscribe(() => this.publish({ bottomWindow: this.bottomWindow.getSnapshot() }))];
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current() { return !this.disposed && this.deps.isCurrent(); }
  private publish(patch: Partial<AdminWorkMapMoveState>) {
    this.state = { ...this.state, ...patch }; if (!this.batching) this.listeners.forEach(listener => listener());
  }
  start() { if (this.current()) { this.topWindow.start(); this.bottomWindow.start(); } }
  setCatalog(catalog: readonly AdminApparatus[]) {
    if (!this.current()) return;
    this.state = { ...this.state, ...adminWorkMapMoveDefaults(catalog, this.state.top, this.state.bottom) }; this.configure();
  }
  setActive(active: boolean) { if (this.current() && this.active !== active) { this.active = active; this.configure(); } }
  private configure() {
    this.batching = true;
    try {
      const { top, bottom } = this.state, ready = this.active && top != null && bottom != null;
      this.topWindow.configure(ready ? { view: 'move', apparatus: top.id, target: bottom.id } : null);
      this.bottomWindow.configure(ready ? { view: 'move', apparatus: bottom.id, target: top.id } : null);
    } finally { this.batching = false; this.publish({}); }
  }
  setQuery(value: string) { if (this.current()) { this.topWindow.setQuery(value); this.bottomWindow.setQuery(value); } }
  async reload() { if (this.current() && this.active) await Promise.all([this.topWindow.reload(), this.bottomWindow.reload()]); }
  invalidate() {
    if (this.disposed) return;
    this.batching = true;
    try { this.topWindow.invalidate(); this.bottomWindow.invalidate(); this.state = { ...this.state, top: null, bottom: null }; }
    finally { this.batching = false; this.publish({}); }
  }
  dispose() { this.invalidate(); this.disposed = true; this.stop.forEach(stop => stop()); this.topWindow.dispose(); this.bottomWindow.dispose(); this.listeners.clear(); }
}
