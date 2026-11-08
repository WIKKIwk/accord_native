import { assertQolipReadCurrent } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

/** A mounted read-only picker lifetime, not another session witness, data reader or mutation gate. */
export class QolipLocationChoiceLifetime {
  private active = false;
  private expired = false;
  private stop: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly boundary: QolipHomeReadBoundary) {}
  private readBoundary = () => this.boundary.current();
  getSnapshot = (): boolean => {
    if (this.expired) return false;
    try { assertQolipReadCurrent(this.readBoundary); return !this.expired; }
    catch { this.expired = true; return false; }
  };
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private invalidate() {
    this.expired = true; this.active = false;
    const stop = this.stop; this.stop = null;
    try { stop?.(); } finally { for (const listener of [...this.listeners]) listener(); }
  }
  activate() {
    if (!this.getSnapshot()) { this.invalidate(); return; }
    if (this.active) return;
    this.active = true;
    let stop: unknown;
    try { stop = this.boundary.subscribe(() => { if (!this.getSnapshot()) this.invalidate(); }); }
    catch { this.invalidate(); return; }
    if (typeof stop !== 'function') {
      void Promise.resolve(stop).then(cleanup => { if (typeof cleanup === 'function') cleanup(); }).catch(() => {});
      this.invalidate(); return;
    }
    if (!this.canChoose()) { stop(); return; }
    this.stop = () => { stop(); };
  }
  canChoose(): boolean {
    if (!this.active) return false;
    if (!this.getSnapshot()) { this.invalidate(); return false; }
    return true;
  }
  suspend() {
    this.active = false;
    const stop = this.stop; this.stop = null; stop?.();
  }
}
