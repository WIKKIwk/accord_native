import type { Session } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';
import type { DispatchRecord } from '../shared/notificationApi';
import { supplierVisibleItems } from './supplierScreenModel';

type Listener = () => void;
export type SupplierPickerState = { loading: boolean; error: unknown | null; items: SupplierItem[]; query: string };
export class SupplierPickerController {
  private state: SupplierPickerState = { loading: true, error: null, items: [], query: '' };
  private readonly listeners = new Set<Listener>();
  private active = false;
  private generation = 0;
  constructor(private readonly session: Session, private readonly read: (session: Session) => Promise<SupplierItem[]>) {}
  subscribe = (listener: Listener): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = (): SupplierPickerState => this.state;
  private set(patch: Partial<SupplierPickerState>): void { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  get visibleItems(): SupplierItem[] { return supplierVisibleItems(this.state.items, this.state.query); }
  start(): void { this.active = true; void this.reload(); }
  stop(): void { this.active = false; this.generation++; }
  setQuery(query: string): void { this.set({ query }); }
  async reload(): Promise<void> {
    const generation = ++this.generation;
    this.set({ loading: true, error: null });
    try {
      const items = await this.read(this.session);
      if (this.active && generation === this.generation) this.set({ loading: false, items });
    } catch (error) {
      if (this.active && generation === this.generation) this.set({ loading: false, error });
    }
  }
}

export type SupplierConfirmServices = {
  create: (session: Session, itemCode: string, qty: number) => Promise<DispatchRecord>;
  recordCreatedPending: () => void;
};
export type SupplierConfirmCallbacks = { onSuccess: (record: DispatchRecord) => Promise<void>; onFailure: (message: string) => void };

/** State for V2 SupplierConfirmScreen, including the push-and-return submitting guard. */
export class SupplierConfirmController {
  private submitting = false;
  private active = false;
  private readonly listeners = new Set<Listener>();
  constructor(private readonly session: Session, readonly item: SupplierItem, readonly qty: number,
    private readonly services: SupplierConfirmServices, private callbacks: SupplierConfirmCallbacks) {}
  subscribe = (listener: Listener): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = (): boolean => this.submitting;
  setCallbacks(callbacks: SupplierConfirmCallbacks): void { this.callbacks = callbacks; }
  start(): void { this.active = true; }
  stop(): void { this.active = false; }
  private set(value: boolean): void { this.submitting = value; for (const listener of this.listeners) listener(); }
  async submit(): Promise<void> {
    if (this.submitting) return;
    this.set(true);
    try {
      const record = await this.services.create(this.session, this.item.code, this.qty);
      this.services.recordCreatedPending();
      if (this.active) await this.callbacks.onSuccess(record);
    } catch (error) {
      if (this.active) this.callbacks.onFailure(`Jo‘natish saqlanmadi: ${String(error)}`);
    } finally { if (this.active) this.set(false); }
  }
}
