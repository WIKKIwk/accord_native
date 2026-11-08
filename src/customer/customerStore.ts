import { compareCreatedLabelsDesc, type CustomerDeliveryRuntimeStore, type CustomerSummary } from '../shared/dispatchRuntimeStores';
import type { DispatchRecord } from '../shared/notificationApi';

export type CustomerStatusKind = 'pending' | 'confirmed' | 'rejected';
export type CustomerStoreApi = {
  customerSummary: () => Promise<CustomerSummary>;
  customerStatusDetails: (kind: CustomerStatusKind) => Promise<DispatchRecord[]>;
};

/** @v2 CustomerStore */
export class CustomerStore {
  private _loading = false;
  private _loaded = false;
  private _error: unknown = null;
  private _summary: CustomerSummary = { pendingCount: 0, confirmedCount: 0, rejectedCount: 0 };
  private _pendingItems: DispatchRecord[] = [];
  private _confirmedItems: DispatchRecord[] = [];
  private _rejectedItems: DispatchRecord[] = [];
  private _historyItems: DispatchRecord[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly api: CustomerStoreApi, private readonly runtime: CustomerDeliveryRuntimeStore) {
    runtime.subscribe(() => this.notify());
  }

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(): void { for (const listener of this.listeners) listener(); }
  get loading(): boolean { return this._loading; }
  get loaded(): boolean { return this._loaded; }
  get error(): unknown { return this._error; }
  get summary(): CustomerSummary { return this.runtime.applySummary(this._summary); }
  get pendingItems(): DispatchRecord[] { return this.runtime.applyStatusList('pending', this._pendingItems); }
  get confirmedItems(): DispatchRecord[] { return this.runtime.applyStatusList('confirmed', this._confirmedItems); }
  get rejectedItems(): DispatchRecord[] { return this.runtime.applyStatusList('rejected', this._rejectedItems); }
  get historyItems(): DispatchRecord[] { return this.runtime.applyHistory(this._historyItems); }

  itemsForKind(kind: CustomerStatusKind): DispatchRecord[] {
    switch (kind) {
      case 'pending': return this.pendingItems;
      case 'confirmed': return this.confirmedItems;
      case 'rejected': return this.rejectedItems;
    }
  }

  async bootstrap(force = false): Promise<void> {
    if (this._loading || (this._loaded && !force)) return;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this._loading) return;
    this._loading = true;
    this._error = null;
    this.notify();
    try {
      // Dart Future.wait uses eagerError: false. Wait for all four requests even
      // after the first failure, and retain the first error in completion order.
      let failed = false;
      let firstError: unknown;
      const wait = <T>(run: () => Promise<T>): Promise<T | undefined> => Promise.resolve().then(run).catch(error => {
        if (!failed) { failed = true; firstError = error; }
        return undefined;
      });
      const [summary, pending, confirmed, rejected] = await Promise.all([
        wait(() => this.api.customerSummary()),
        wait(() => this.api.customerStatusDetails('pending')),
        wait(() => this.api.customerStatusDetails('confirmed')),
        wait(() => this.api.customerStatusDetails('rejected')),
      ]);
      if (failed) throw firstError;
      this._summary = summary as CustomerSummary;
      this._pendingItems = pending as DispatchRecord[];
      this._confirmedItems = confirmed as DispatchRecord[];
      this._rejectedItems = rejected as DispatchRecord[];
      const byId = new Map<string, DispatchRecord>();
      for (const item of [...this._pendingItems, ...this._confirmedItems, ...this._rejectedItems]) byId.set(item.id, item);
      this._historyItems = [...byId.values()].sort((a, b) => compareCreatedLabelsDesc(a.created_label, b.created_label));
      this._loaded = true;
      this.runtime.reconcileStatusLists(this._pendingItems, this._confirmedItems, this._rejectedItems);
      this.runtime.setStatusSnapshot('pending', this._pendingItems);
      this.runtime.setStatusSnapshot('confirmed', this._confirmedItems);
      this.runtime.setStatusSnapshot('rejected', this._rejectedItems);
    } catch (error) {
      this._error = error;
      if (!this._loaded) {
        this._pendingItems = [];
        this._confirmedItems = [];
        this._rejectedItems = [];
        this._historyItems = [];
      }
    } finally {
      this._loading = false;
      this.notify();
    }
  }

  applyDetailTransition(before: DispatchRecord, after: DispatchRecord): void { this.runtime.recordTransition(before, after); }
  applyIncomingRecord(record: DispatchRecord): void { this.runtime.recordIncoming(record); }

  clear(): void {
    this._loading = false;
    this._loaded = false;
    this._error = null;
    this._summary = { pendingCount: 0, confirmedCount: 0, rejectedCount: 0 };
    this._pendingItems = [];
    this._confirmedItems = [];
    this._rejectedItems = [];
    this._historyItems = [];
    this.notify();
  }
}
