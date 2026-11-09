import { assertQolipReadCurrent, trimDart, type QolipReadGuard } from './qolipApiCommon';
import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import { qolipFilterCheckouts } from './qolipCheckoutLogic';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

export type QolipCheckoutReadSnapshot = {
  invalid: boolean;
  loading: boolean;
  error: boolean;
  entries: readonly QolipCheckoutEntry[] | null;
  visible: readonly QolipCheckoutEntry[];
  search: string;
};
const invalid: QolipCheckoutReadSnapshot = Object.freeze({ invalid: true, loading: false, error: false, entries: null, visible: [], search: '' });
type Run = { active: boolean; serial: number; stop: (() => void) | null };
function absorbThenable(value: unknown) {
  try {
    if (value && (typeof value === 'object' || typeof value === 'function') &&
        typeof (value as { then?: unknown }).then === 'function') void Promise.resolve(value).catch(() => {});
  } catch { /* Invalid callbacks cannot keep a closed read lifetime alive. */ }
}

/** Unrouted read-only ledger lifetime. The caller supplies the original non-revivable boundary. */
export class QolipCheckoutReadState {
  private readonly listeners = new Set<() => void>();
  private value: QolipCheckoutReadSnapshot = { invalid: false, loading: true, error: false, entries: null, visible: [], search: '' };
  private expired = false;
  private run: Run | null = null;
  constructor(private readonly boundary: QolipHomeReadBoundary,
    private readonly read: (guard: QolipReadGuard) => Promise<readonly QolipCheckoutEntry[]>,
    private readonly onLoaded?: (entries: readonly QolipCheckoutEntry[]) => boolean) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private originalCurrent = () => this.boundary.current();
  private current(): boolean {
    if (this.expired) return false;
    try { assertQolipReadCurrent(this.originalCurrent); return !this.expired; } catch { this.expired = true; return false; }
  }
  getSnapshot = (): QolipCheckoutReadSnapshot => (!this.run || this.run.active) && this.current() ? this.value : invalid;
  private notify() { for (const listener of [...this.listeners]) {
    try { const result: unknown = listener(); absorbThenable(result); } catch { /* Other observers still invalidate. */ }
  } }
  private close(run: Run) {
    run.active = false; run.serial++;
    const stop = run.stop; run.stop = null;
    try { const result: unknown = stop?.(); absorbThenable(result); } catch { /* The lifetime is already closed. */ }
  }
  private invalidate() {
    this.expired = true;
    if (this.run) this.close(this.run);
    this.value = invalid; this.notify();
  }
  private runCurrent(run: Run): boolean {
    if (this.run !== run || !run.active) return false;
    if (!this.current()) { this.invalidate(); return false; }
    return true;
  }
  activate(): () => void {
    if (this.run?.active) return () => {};
    const run: Run = { active: true, serial: 0, stop: null }; this.run = run;
    const suspend = () => { if (this.run !== run || !run.active) return; this.close(run); this.notify(); };
    if (!this.current()) { this.invalidate(); return suspend; }
    let stop: unknown;
    try { stop = this.boundary.subscribe(() => { if (!this.current()) this.invalidate(); }); }
    catch { this.invalidate(); return suspend; }
    if (typeof stop !== 'function') {
      void Promise.resolve(stop).then(cleanup => { if (typeof cleanup === 'function') return cleanup(); }).catch(() => {});
      this.invalidate(); return suspend;
    }
    if (!this.runCurrent(run)) { try { absorbThenable(stop()); } catch {} return suspend; }
    run.stop = stop as () => void;
    this.value = { invalid: false, loading: true, error: false, entries: null, visible: [], search: '' };
    this.notify(); void this.reload(); return suspend;
  }
  setSearch(search: string) {
    const run = this.run;
    if (!run || !this.runCurrent(run)) return;
    const visible = this.value.entries ? qolipFilterCheckouts(this.value.entries, trimDart(search)) : [];
    if (!this.runCurrent(run)) return;
    this.value = { ...this.value, search, visible };
    this.notify();
  }
  async reload(): Promise<void> {
    const run = this.run;
    if (!run || !this.runCurrent(run)) return;
    const serial = ++run.serial, guard = () => this.runCurrent(run);
    // A pending replacement future retains the previous FutureBuilder data.
    this.value = { ...this.value, loading: true, error: false }; this.notify();
    try {
      assertQolipReadCurrent(guard);
      const entries = await this.read(guard);
      if (!guard()) return;
      if (this.onLoaded) {
        try { assertQolipReadCurrent(() => this.onLoaded!(entries)); }
        catch { this.invalidate(); return; }
      }
      if (!guard() || serial !== run.serial) return;
      const visible = qolipFilterCheckouts(entries, trimDart(this.value.search));
      if (!guard() || serial !== run.serial) return;
      this.value = { ...this.value, entries, visible, loading: false, error: false };
      this.notify();
    } catch {
      if (!guard() || serial !== run.serial) return;
      this.value = { ...this.value, entries: null, visible: [], loading: false, error: true }; this.notify();
    }
  }
}
