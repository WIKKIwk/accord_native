import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemDetail, AdminItemDetailCustomer } from './adminItemDetailModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminItemDetailCustomersState = Readonly<{
  detail: AdminItemDetail; customers: readonly AdminItemDetailCustomer[]; selectedRefs: readonly string[];
  loading: boolean; error: unknown | null; pendingRef: string | null; closing: boolean;
}>;
export type AdminItemDetailCustomerRow = Readonly<{ customer: AdminItemDetailCustomer }>;
type Dependencies = Readonly<{
  isCurrent: () => boolean;
  canInteract: () => boolean;
  load: (query: string, guard: () => void, witness: () => boolean) => Promise<readonly AdminItemDetailCustomer[]>;
  /** Accepted mutations use the parent page lifetime, so native picker dismissal must not cancel a dispatched write. */
  setAssigned: (customer: AdminItemDetailCustomer, assigned: boolean) => Promise<AdminItemDetail>;
  notice: (error: unknown) => void;
}>;
const key = (customer: AdminItemDetailCustomer) => dartPartialLower(dartTrim(customer.ref));
const selected = (detail: AdminItemDetail) => new Map(detail.customers.map(customer => [key(customer), customer]));

/** @v2 _ItemCustomerPickerSheetState; search submits explicitly and overlapping loads retain source settlement order. */
export class AdminItemDetailCustomersController {
  private state: AdminItemDetailCustomersState;
  private selected: Map<string, AdminItemDetailCustomer>; private search = ''; private active = false; private retired = false;
  private checking = false; private generation = 0;
  private rows = new WeakMap<AdminItemDetailCustomerRow, { generation: number; customers: readonly AdminItemDetailCustomer[] }>();
  private readonly listeners = new Set<() => void>();
  constructor(detail: AdminItemDetail, private readonly deps: Dependencies) {
    this.selected = selected(detail); this.state = Object.freeze({ detail, customers: Object.freeze([]), selectedRefs: Object.freeze([...this.selected.keys()]), loading: true, error: null, pendingRef: null, closing: false });
  }
  getSnapshot = () => this.state;
  get interactionGeneration() { return this.generation; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminItemDetailCustomersState>): void {
    this.state = Object.freeze({ ...this.state, ...patch }); for (const listener of [...this.listeners]) listener();
  }
  isCurrent = (generation = this.generation): boolean => {
    if (!this.active || this.retired || generation !== this.generation) return false;
    if (this.checking) { this.dispose(); return false; }
    this.checking = true; const valid = isSynchronouslyTrue(this.deps.isCurrent); this.checking = false;
    if (!valid || this.retired) { this.dispose(); return false; } return this.active && generation === this.generation;
  };
  private check(generation: number): void { if (!this.isCurrent(generation)) throw new Error('Item customer picker changed'); }
  private interactive(): boolean { return this.isCurrent() && !this.state.closing && isSynchronouslyTrue(this.deps.canInteract) && this.isCurrent() && !this.state.closing; }
  start(): void { if (this.active || this.retired) return; this.active = true; this.generation++; void this.load(); }
  changeSearch(value: string): void { if (this.interactive()) this.search = value; }
  async load(): Promise<void> {
    if (!this.interactive()) return; const generation = this.generation, query = dartTrim(this.search), guard = () => this.check(generation);
    this.publish({ loading: true, error: null });
    try {
      guard(); const loaded = await this.deps.load(query, guard, () => { guard(); return true; }); guard();
      const byRef = new Map(this.selected); for (const customer of loaded) { const ref = key(customer); if (ref) byRef.set(ref, customer); }
      const customers = Object.freeze([...byRef.values()].sort((left, right) => { const a = dartPartialLower(left.name), b = dartPartialLower(right.name); return a < b ? -1 : a > b ? 1 : 0; }));
      guard(); this.publish({ customers, loading: false });
    } catch (error) { if (this.isCurrent(generation)) this.publish({ loading: false, error }); }
  }
  row(customer: AdminItemDetailCustomer): AdminItemDetailCustomerRow | null {
    if (!this.interactive() || this.state.loading || this.state.error !== null || !this.state.customers.includes(customer)) return null;
    const row = Object.freeze({ customer }); this.rows.set(row, { generation: this.generation, customers: this.state.customers }); return row;
  }
  async toggle(row: AdminItemDetailCustomerRow, assigned: boolean): Promise<void> {
    const captured = this.rows.get(row);
    if (!captured || !this.interactive() || captured.generation !== this.generation || captured.customers !== this.state.customers || this.state.loading || this.state.error !== null || this.state.pendingRef !== null) return;
    const ref = key(row.customer); if (!ref) return;
    const generation = this.generation; this.publish({ pendingRef: ref });
    try {
      this.check(generation); if (this.state.closing) return;
      const updated = await this.deps.setAssigned(row.customer, assigned); this.check(generation);
      this.selected = selected(updated); this.publish({ detail: updated, selectedRefs: Object.freeze([...this.selected.keys()]) });
    } catch (error) { if (this.isCurrent(generation)) this.deps.notice(error); }
    finally { if (this.isCurrent(generation)) this.publish({ pendingRef: null }); }
  }
  /** Immediate native-hide fence; Done is disabled while pending, source barrier/back cancellation remains available. */
  prepareClose(done: boolean): AdminItemDetail | null | false {
    if (!this.interactive() || done && this.state.pendingRef !== null) return false;
    const detail = done ? this.state.detail : null; this.publish({ closing: true }); return detail;
  }
  dispose(): void {
    if (this.retired) return; this.retired = true; this.active = false; this.generation++; this.rows = new WeakMap();
    this.publish({ customers: Object.freeze([]), selectedRefs: Object.freeze([]), loading: false, error: null, pendingRef: null, closing: true });
  }
}
