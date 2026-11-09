import type { QolipLocationEntry } from './qolipLocationsApi';
import { isGuardedReadRefreshUnavailable } from './qolipApiCommon';

/** Required non-revivable original-session boundary. Use the injected shared-witness adapter, never an identity/scope substitute. */
export type QolipHomeReadBoundary = {
  current: () => boolean;
  subscribe: (listener: () => void) => () => void;
};
export type QolipHomeBlockReadSnapshot = {
  locations: readonly QolipLocationEntry[] | null;
  loading: boolean;
  error: boolean;
  refreshUnavailable?: boolean;
  invalid: boolean;
};
const invalidSnapshot: QolipHomeBlockReadSnapshot = Object.freeze({ locations: null, loading: false, error: false, invalid: true });
function safelyInvoke(callback: () => unknown) {
  try {
    const result = callback();
    if (result && (typeof result === 'object' || typeof result === 'function') &&
        typeof (result as { then?: unknown }).then === 'function') void Promise.resolve(result).catch(() => {});
  } catch { /* Other observers and cleanup must still run. */ }
}

/** The existing Home controller owns futures and cached reads; this only models a block's FutureBuilder snapshot. */
export class QolipHomeBlockReadState {
  private value: QolipHomeBlockReadSnapshot;
  private active = false;
  private invalid = false;
  private expired = false;
  private checking = false;
  private generation = 0;
  private future: Promise<readonly QolipLocationEntry[]> | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(initialLocations: readonly QolipLocationEntry[] | null, private readonly boundary: QolipHomeReadBoundary) {
    this.value = { locations: initialLocations, loading: true, error: false, invalid: false };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current(): boolean {
    if (this.invalid || this.expired) return false;
    if (this.checking) { this.expired = true; return false; }
    this.checking = true;
    try {
      const value: unknown = this.boundary.current();
      // Invalid async evaluators are never accepted; observe their rejection without exposing data.
      if (value !== true) {
        if (value !== null && (typeof value === 'object' || typeof value === 'function')) void Promise.resolve(value).catch(() => {});
        this.expired = true;
      }
    } catch { this.expired = true; }
    finally { this.checking = false; }
    return !this.expired && !this.invalid;
  }
  getSnapshot = (): QolipHomeBlockReadSnapshot => this.invalid || !this.current() ? invalidSnapshot : this.value;
  private notify() { for (const listener of [...this.listeners]) safelyInvoke(listener); }
  private invalidate() {
    if (this.invalid) return;
    this.invalid = true; this.generation++; this.future = null; this.value = invalidSnapshot;
    const stop = this.unsubscribe; this.unsubscribe = null; if (stop) safelyInvoke(stop); this.notify();
  }
  activate(): void {
    if (this.invalid || !this.current()) { this.invalidate(); return; }
    if (this.active) return;
    this.active = true;
    let stop: unknown;
    try { stop = this.boundary.subscribe(() => { if (!this.current()) this.invalidate(); }); }
    catch (error) { this.invalidate(); throw error; }
    if (typeof stop !== 'function') {
      void Promise.resolve(stop).then(cleanup => { if (typeof cleanup === 'function') return cleanup(); }).catch(() => {});
      this.invalidate(); throw new TypeError('Qolip Home requires a synchronous boundary subscription');
    }
    // A boundary may become stale or notify synchronously while the subscription is installed.
    if (this.invalid || !this.current()) { safelyInvoke(stop as () => unknown); this.invalidate(); return; }
    this.unsubscribe = () => { safelyInvoke(stop as () => unknown); };
  }
  canAct(): boolean {
    if (!this.active || this.invalid) return false;
    if (!this.current()) { this.invalidate(); return false; }
    return true;
  }
  bind(future: Promise<readonly QolipLocationEntry[]>): void {
    if (!this.canAct()) { void future.catch(() => {}); return; }
    if (future === this.future) return;
    this.future = future;
    const generation = ++this.generation;
    this.value = { ...this.value, loading: true }; this.notify();
    void future.then(locations => {
      if (generation !== this.generation || !this.canAct()) return;
      this.value = { locations, loading: false, error: false, invalid: false }; this.notify();
    }, error => {
      if (generation !== this.generation || !this.canAct()) return;
      // FutureBuilder's AsyncSnapshot.withError discards the prior data on settled error.
      this.value = { locations: null, loading: false, error: true, invalid: false,
        ...(isGuardedReadRefreshUnavailable(error) ? { refreshUnavailable: true } : {}) }; this.notify();
    });
  }
  suspend(): void {
    this.active = false; this.generation++; this.future = null;
    const stop = this.unsubscribe; this.unsubscribe = null; if (stop) safelyInvoke(stop);
  }
}
