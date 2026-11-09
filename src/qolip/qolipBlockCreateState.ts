import type { Session } from '../auth';
import { assertQolipReadCurrent, trimDart, type QolipReadGuard } from './qolipApiCommon';
import { qolipCreateBlock, type QolipBlock } from './qolipBlocksApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';

export type QolipBlockCreateOptions = { warehouses: readonly string[]; initialWarehouse?: string; showWarehouseField?: boolean };
type Snapshot = { warehouse: string | null; name: string; saving: boolean; invalid: boolean };
const invalidSnapshot: Snapshot = Object.freeze({ warehouse: null, name: '', saving: false, invalid: true });

/** @v2 _QolipBlockCreateSheetState */
export class QolipBlockCreateState {
  readonly warehouses: readonly string[];
  readonly showWarehouseField: boolean;
  private value: Snapshot;
  private active = false;
  private expired = false;
  private generation = 0;
  private stop: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(options: QolipBlockCreateOptions, private readonly boundary: QolipHomeReadBoundary,
    private readonly create: (input: { warehouse: string; block: string }, guard: QolipReadGuard) => Promise<QolipBlock>) {
    this.warehouses = [...options.warehouses]; this.showWarehouseField = options.showWarehouseField ?? true;
    const initial = trimDart(options.initialWarehouse ?? '');
    this.value = { warehouse: initial || (options.warehouses.length ? options.warehouses[0] : null), name: '', saving: false, invalid: false };
  }
  static forSession(session: Session, boundary: QolipHomeReadBoundary, options: QolipBlockCreateOptions) {
    return new QolipBlockCreateState(options, boundary, (input, guard) => qolipCreateBlock(session, input, guard));
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current = () => {
    if (this.expired) return false;
    try { assertQolipReadCurrent(this.readBoundary); return true; }
    catch { this.expired = true; return false; }
  };
  private readBoundary = () => this.boundary.current();
  getSnapshot = (): Snapshot => this.current() ? this.value : invalidSnapshot;
  get canSave(): boolean {
    return this.current() && !!trimDart(this.value.warehouse ?? '') && !!trimDart(this.value.name);
  }
  canAct = (): boolean => {
    if (!this.active) return false;
    if (!this.current()) { this.invalidate(); return false; }
    return true;
  };
  private publish(patch: Partial<Snapshot>) {
    this.value = { ...this.value, ...patch };
    for (const listener of [...this.listeners]) listener();
  }
  activate() {
    if (!this.current()) { this.invalidate(); return; }
    if (this.active) return;
    this.active = true;
    let stop: unknown;
    try { stop = this.boundary.subscribe(() => { if (!this.current()) this.invalidate(); }); }
    catch { this.invalidate(); return; }
    if (typeof stop !== 'function') {
      void Promise.resolve(stop).then(cleanup => { if (typeof cleanup === 'function') cleanup(); }).catch(() => {});
      this.invalidate(); return;
    }
    if (!this.canAct()) { stop(); return; }
    this.stop = () => { stop(); };
  }
  setWarehouse(warehouse: string | null) { if (this.canAct()) this.publish({ warehouse }); }
  setName(name: string) { if (this.canAct()) this.publish({ name }); }
  async save(): Promise<QolipBlock | null> {
    if (!this.canAct() || !this.canSave || this.value.saving) return null;
    const input = { warehouse: trimDart(this.value.warehouse ?? ''), block: trimDart(this.value.name) }, generation = this.generation;
    const guard = () => generation === this.generation && this.canAct();
    this.publish({ saving: true });
    try {
      if (!guard()) return null;
      const created = await this.create(input, guard);
      return guard() ? created : null;
    } finally {
      // A thrown/uncertain response has no invented error UI or automatic resend.
      // Re-enabling the source form does not establish that a retry is safe; this sheet remains unrouted.
      if (guard()) this.publish({ saving: false });
    }
  }
  private invalidate() {
    this.expired = true; this.active = false; this.generation++;
    const stop = this.stop; this.stop = null;
    try { stop?.(); } finally { this.publish(invalidSnapshot); }
  }
  suspend() {
    this.active = false; this.generation++;
    const stop = this.stop; this.stop = null;
    // A dismissed saving form must never revive an old operation or expose its result.
    if (this.value.saving) this.expired = true;
    stop?.();
  }
}
