import { qolipHomeBlockKey } from './qolipHomeLogic';
import { qolipHomePresentation, type QolipHomePresentation } from './qolipHomePresentation';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipHomeState } from './qolipHomeState';
import type { QolipLocationEntry } from './qolipLocationsApi';

export type QolipOwnedHomeBlock = {
  key: string;
  block: QolipBlock;
  future: Promise<readonly QolipLocationEntry[]>;
  initialLocations: readonly QolipLocationEntry[] | null;
};
export type QolipHomeOwnerActions = {
  current: () => boolean;
  setSearch: (value: string) => void;
  select: (index: number) => void;
};
export type QolipHomeOwnerSnapshot = {
  home: QolipHomePresentation;
  search: string;
  blocks: readonly QolipOwnedHomeBlock[];
  boundary: QolipHomeReadBoundary | null;
  actions: QolipHomeOwnerActions | null;
};
const invalidSnapshot: QolipHomeOwnerSnapshot = Object.freeze({
  home: { kind: 'invalid' as const }, search: '', blocks: [], boundary: null, actions: null,
});
function safelyInvoke(callback: () => unknown) {
  try {
    const result = callback();
    if (result && (typeof result === 'object' || typeof result === 'function') &&
        typeof (result as { then?: unknown }).then === 'function') void Promise.resolve(result).catch(() => {});
  } catch { /* Other observers and cleanup must still run. */ }
}
type Run = {
  active: boolean;
  suspended: boolean;
  controller: QolipHomeState;
  actions: QolipHomeOwnerActions;
  boundary: QolipHomeReadBoundary;
  listeners: Set<() => void>;
  stopBoundary: (() => void) | null;
  stopHome: (() => void) | null;
};

/** A role-local owner of the existing Home controller, not a new request/cache or authentication mechanism. */
export class QolipHomeOwnerState {
  private expired = false;
  private invalidated = false;
  private checking = false;
  private run: Run;
  private value: QolipHomeOwnerSnapshot;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly originalBoundary: QolipHomeReadBoundary,
    private readonly createController: (isCurrent: () => boolean) => QolipHomeState) {
    this.run = this.createRun();
    this.value = this.initialSnapshot(this.run);
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): QolipHomeOwnerSnapshot => this.run.suspended || !this.originalCurrent() ? invalidSnapshot : this.value;
  private notify() { for (const listener of [...this.listeners]) safelyInvoke(listener); }
  private originalCurrent(): boolean {
    if (this.expired) return false;
    if (this.checking) { this.expired = true; return false; }
    this.checking = true;
    try {
      const result: unknown = this.originalBoundary.current();
      if (result !== true) {
        if (result !== null && (typeof result === 'object' || typeof result === 'function')) void Promise.resolve(result).catch(() => {});
        this.expired = true;
      }
    } catch { this.expired = true; }
    finally { this.checking = false; }
    return !this.expired;
  }
  private runCurrent(run: Run): boolean {
    if (run !== this.run || !run.active || run.suspended) return false;
    if (!this.originalCurrent()) { this.invalidate(); return false; }
    return true;
  }
  private createRun(): Run {
    // A disposed React effect gets a fresh controller/lifetime, never a fresh account witness.
    const run = { active: false, suspended: false, stopBoundary: null, stopHome: null, listeners: new Set() } as Run;
    const current = () => this.runCurrent(run);
    run.boundary = Object.freeze({ current, subscribe: (listener: () => void) => {
      run.listeners.add(listener); return () => { run.listeners.delete(listener); };
    } });
    run.controller = this.createController(current);
    run.actions = Object.freeze({
      current,
      setSearch: (search: string) => {
        if (!current()) return;
        this.value = { ...this.value, search }; this.notify();
        if (current()) run.controller.setQuery(search);
      },
      select: (index: number) => { if (current()) run.controller.select(index); },
    });
    return run;
  }
  private initialSnapshot(run: Run): QolipHomeOwnerSnapshot {
    return { home: qolipHomePresentation(run.controller.getSnapshot()), search: '', blocks: [], boundary: run.boundary, actions: run.actions };
  }
  private publishController(run: Run) {
    if (!this.runCurrent(run)) return;
    const home = qolipHomePresentation(run.controller.getSnapshot());
    // V2 builds every block's _locationsFor future in its TabBarView children.
    // These are references to the controller's real cache, not another owner-owned future cache.
    const blocks = home.kind === 'blocks' ? home.tabs.map(tab => {
      const future = run.controller.locationsFor(tab.block.name);
      // A rejection can arrive before React mounts the body, or after it was removed.
      // Observe it without changing the original future/error delivered to FutureBuilder state.
      void future.catch(() => {});
      return { key: qolipHomeBlockKey(tab.block), block: tab.block, future,
        initialLocations: run.controller.resolvedFor(tab.block.name) };
    }) : [];
    // An early read/consumer may have invalidated the owner while the descriptors were made.
    if (!this.runCurrent(run)) return;
    this.value = { ...this.value, home, blocks, boundary: run.boundary, actions: run.actions }; this.notify();
  }
  activate(): QolipHomeOwnerActions | null {
    if (!this.originalCurrent()) { this.invalidate(); return null; }
    if (this.run.active) return this.run.actions;
    if (this.run.suspended) { this.run = this.createRun(); this.value = this.initialSnapshot(this.run); }
    const run = this.run; run.active = true;
    let stop: unknown;
    try { stop = this.originalBoundary.subscribe(() => { if (!this.originalCurrent()) this.invalidate(); }); }
    catch { this.invalidate(); return null; }
    if (typeof stop !== 'function') {
      void Promise.resolve(stop).then(cleanup => { if (typeof cleanup === 'function') return cleanup(); }).catch(() => {});
      this.invalidate(); return null;
    }
    if (!this.runCurrent(run)) { safelyInvoke(stop as () => unknown); return null; }
    run.stopBoundary = () => { safelyInvoke(stop as () => unknown); };
    run.stopHome = run.controller.subscribe(() => this.publishController(run));
    this.publishController(run);
    if (this.runCurrent(run)) void run.controller.start().catch(() => {});
    return this.runCurrent(run) ? run.actions : null;
  }
  private stopRun(run: Run) {
    run.active = false; run.suspended = true;
    const stopBoundary = run.stopBoundary, stopHome = run.stopHome; run.stopBoundary = null; run.stopHome = null;
    // Cleanup must not prevent the controller and every retained body being invalidated.
    if (stopBoundary) safelyInvoke(stopBoundary);
    if (stopHome) safelyInvoke(stopHome);
    safelyInvoke(() => run.controller.invalidateSession()); safelyInvoke(() => run.controller.dispose());
    for (const listener of [...run.listeners]) safelyInvoke(listener);
    run.listeners.clear();
  }
  private invalidate() {
    this.expired = true;
    if (this.invalidated) return;
    this.invalidated = true; this.stopRun(this.run); this.value = invalidSnapshot; this.notify();
  }
  suspend(actions: QolipHomeOwnerActions | null): void {
    if (!actions || actions !== this.run.actions || this.run.suspended) return;
    this.stopRun(this.run); this.value = invalidSnapshot; this.notify();
  }
}
