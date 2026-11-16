import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminWarehouseMainActionContext } from './AdminWarehouseMainScreenTypes';
import { dartTrim } from './dartJsonString';
import type { AdminWarehouseStockItem, AdminWarehouseStockRoll } from './warehouseStockApi';

type Details = { id: number; index: number; roll: AdminWarehouseStockRoll; closing: boolean };
export type AdminWarehouseItemRollsPresentation = { id: number; item: AdminWarehouseStockItem; phase: 'loading' | 'ready' | 'error'; rolls: readonly AdminWarehouseStockRoll[]; details: Details | null; closing: boolean };
type State = { valid: boolean; presentation: AdminWarehouseItemRollsPresentation | null };
type Dependencies = { current: () => boolean; read: (item: AdminWarehouseStockItem, guard: () => void, witness: () => boolean) => Promise<readonly AdminWarehouseStockRoll[]> };
/** Owns the complete awaited child, from the source's pre-presentation read until native dismissal. */
export class AdminWarehouseItemRollsController {
  private state: State = { valid: true, presentation: null }; private listeners = new Set<() => void>();
  private active = false; private lifetime = 0; private serial = 0; private opening = false; private context: AdminWarehouseMainActionContext | null = null; private resolve: (() => void) | null = null;
  constructor(private readonly deps: Dependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<State>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private current(lifetime = this.lifetime) {
    if (!this.active || !this.state.valid || lifetime !== this.lifetime) return false;
    if (!isSynchronouslyTrue(this.deps.current)) { this.invalidate(); return false; }
    return this.active && this.state.valid && lifetime === this.lifetime;
  }
  currentPresentation = (id: number, lifetime = this.lifetime) => {
    if (!this.current(lifetime) || this.state.presentation?.id !== id || this.state.presentation.closing || !this.context) return false;
    const context = this.context;
    if (!isSynchronouslyTrue(context.isCurrent)) { if (this.context === context && this.state.presentation?.id === id) this.close(id); return false; }
    return this.current(lifetime) && this.state.presentation?.id === id && !this.state.presentation.closing && this.context === context;
  };
  start() { if (!this.active && this.state.valid) { this.active = true; this.lifetime++; if (!this.current()) this.invalidate(); } }
  dispose() { this.active = false; this.lifetime++; const resolve = this.resolve; this.resolve = null; this.context = null; this.publish({ presentation: null }); resolve?.(); }
  invalidate() { if (!this.state.valid) return; this.state = { ...this.state, valid: false }; this.dispose(); }
  open = (item: AdminWarehouseStockItem, context: AdminWarehouseMainActionContext): Promise<void> => {
    if (this.opening) return Promise.resolve(); this.opening = true;
    try {
      if (!this.current() || this.state.presentation || !isSynchronouslyTrue(context.isCurrent) || !dartTrim(item.warehouse) || !dartTrim(item.code) || !this.current() || this.state.presentation) return Promise.resolve();
      const id = ++this.serial, lifetime = this.lifetime;
      const result = new Promise<void>(resolve => { this.resolve = resolve; }); this.context = context;
      this.publish({ presentation: { id, item, phase: 'loading', rolls: [], details: null, closing: false } });
      const witness = () => this.currentPresentation(id, lifetime), guard = () => { if (!witness()) throw new Error('Warehouse rolls child changed'); };
      void (async () => {
        try { guard(); const rolls = await this.deps.read(item, guard, witness); guard(); this.publish({ presentation: { ...this.state.presentation!, rolls, phase: 'ready' } }); }
        catch { if (witness()) this.publish({ presentation: { ...this.state.presentation!, phase: 'error' } }); }
      })();
      return result;
    } finally { this.opening = false; }
  };
  beginDismiss(id: number) { if (this.state.presentation?.id === id) this.publish({ presentation: { ...this.state.presentation, closing: true, details: null } }); }
  close(id: number) {
    if (this.state.presentation?.id !== id) return;
    const resolve = this.resolve; this.resolve = null; this.context = null; this.publish({ presentation: null }); resolve?.();
  }
  showDetails(id: number, roll: AdminWarehouseStockRoll) {
    const value = this.state.presentation; if (!this.currentPresentation(id) || value?.details || !value || !value.rolls.includes(roll)) return;
    this.publish({ presentation: { ...value, details: { id: ++this.serial, index: value.rolls.indexOf(roll), roll, closing: false } } });
  }
  dismissDetails(id: number, detailsId: number, completed: boolean) {
    const value = this.state.presentation; if (!value || value.id !== id || value.details?.id !== detailsId) return;
    this.publish({ presentation: { ...value, details: completed ? null : { ...value.details, closing: true } } });
  }
}
