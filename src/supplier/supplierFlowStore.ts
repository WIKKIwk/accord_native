import type { SupplierItem } from '../shared/catalogApi';
import type { DispatchRecord } from '../shared/notificationApi';

export type SupplierFlowState = { item: SupplierItem | null; initialQty: number | undefined; qty: number | null; record: DispatchRecord | null };
const empty = (): SupplierFlowState => ({ item: null, initialQty: undefined, qty: null, record: null });

/** Route arguments are retained in the role session, like V2's in-memory Navigator arguments. */
export class SupplierFlowStore {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  constructor(readonly sessionScope = '') {}
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = (): SupplierFlowState => this.state;
  private set(state: SupplierFlowState): void { this.state = state; for (const listener of this.listeners) listener(); }
  choose(item: SupplierItem, initialQty?: number): void { this.set({ item, initialQty, qty: null, record: null }); }
  setQuantity(qty: number): void { this.set({ ...this.state, qty, record: null }); }
  setRecord(record: DispatchRecord): void { this.set({ ...this.state, record }); }
  clear(): void { this.set(empty()); }
}
