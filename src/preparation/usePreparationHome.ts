import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { registerSessionResetHook, type Session } from '../auth';
import { preparationSnapshot } from '../preparationReadApi';
import { preparationPendingCommand, preparationSubmit } from './preparationCommandApi';

type Snapshot = Awaited<ReturnType<typeof preparationSnapshot>>;
type Pending = Awaited<ReturnType<typeof preparationPendingCommand>>;
type HomeState = { snapshot: Snapshot | null; pending: Pending; warehouse: string | null; orderId: string | null;
  percentages: Record<string, string>; loading: boolean; saving: boolean; error: string | null };

export class PreparationHomeState {
  private state: HomeState = { snapshot: null, pending: null, warehouse: null, orderId: null,
    percentages: {}, loading: true, saving: false, error: null };
  private active = true;
  private invalidated = false;
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor(private readonly session: Session) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<HomeState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  get locked() { return this.invalidated || this.state.loading || this.state.saving || this.state.pending !== null; }
  activate() { this.active = true; }
  sessionChanged() {
    this.invalidated = true; this.revision++;
    this.update({ snapshot: null, pending: null, warehouse: null, orderId: null, percentages: {},
      loading: false, saving: false, error: 'Akkaunt o‘zgargan. Sahifani qayta oching' });
  }
  async reload() {
    if (!this.active || this.invalidated) return;
    const revision = this.revision;
    const current = () => this.active && revision === this.revision;
    this.update({ loading: true, error: null });
    try {
      const pending = await preparationPendingCommand(this.session);
      if (!current()) return;
      this.update({ pending });
      const snapshot = await preparationSnapshot(this.session);
      if (!current()) return;
      let warehouse = this.state.warehouse, orderId = this.state.orderId, percentages = this.state.percentages;
      if (!snapshot.assigned_warehouses.includes(warehouse ?? '')) {
        warehouse = snapshot.assigned_warehouses.length === 1 ? snapshot.assigned_warehouses[0] : null;
      }
      if (orderId && !snapshot.orders.some(order => order.id === orderId && !order.saved)) { orderId = null; percentages = {}; }
      this.update({ snapshot, warehouse, orderId, percentages });
    } catch (error) { if (current()) this.update({ error: String(error) }); }
    finally { if (current()) this.update({ loading: false }); }
  }
  selectWarehouse(warehouse: string) { this.update({ warehouse }); }
  selectOrder(orderId: string) { this.update({ orderId, percentages: {} }); }
  setPercent(code: string, value: string) { this.update({ percentages: { ...this.state.percentages, [code]: value } }); }
  removePercent(code: string) {
    const percentages = { ...this.state.percentages }; delete percentages[code]; this.update({ percentages });
  }
  async submit(kind: string, payload: Record<string, unknown>) {
    if (!this.active || this.invalidated || this.state.saving) return;
    const revision = this.revision;
    this.update({ saving: true });
    try {
      const result = await preparationSubmit(this.session, kind, payload);
      if (this.active && revision === this.revision && kind === 'consumptions') this.update({ orderId: null, percentages: {} });
      return result;
    } finally {
      if (this.active && revision === this.revision) { this.update({ saving: false }); await this.reload(); }
    }
  }
  invalidate() {
    if (!this.active) return;
    this.revision++;
    this.update({ snapshot: null, pending: null, warehouse: null, orderId: null, percentages: {}, loading: false, saving: false,
      error: 'Akkaunt o‘zgargan. Sahifani qayta oching' });
    this.active = false;
  }
  dispose() { this.active = false; this.revision++; this.listeners.clear(); }
}

export function usePreparationHome(session: Session) {
  const controller = useMemo(() => new PreparationHomeState(session), [session]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.activate();
    const unregister = registerSessionResetHook(async () => { controller.sessionChanged(); });
    void controller.reload();
    return () => { unregister(); controller.dispose(); };
  }, [controller]);
  return { ...state, locked: controller.locked, controller };
}
