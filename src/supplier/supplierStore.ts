import type { Session } from '../auth';
import type { SupplierSummary } from '../shared/dispatchRuntimeStores';
import type { DispatchRecord } from '../shared/notificationApi';
import { trimNotificationText } from '../shared/notification/notificationDetailModel';
import type { SupplierStatusBreakdownEntry, SupplierStatusKind } from './supplierApi';

export type SupplierStoreApi = {
  supplierSummary: (session: Session) => Promise<SupplierSummary>;
  supplierHistory: (session: Session) => Promise<DispatchRecord[]>;
  supplierStatusBreakdown: (session: Session, kind: SupplierStatusKind) => Promise<SupplierStatusBreakdownEntry[]>;
  supplierStatusDetails: (session: Session, kind: SupplierStatusKind, itemCode: string) => Promise<DispatchRecord[]>;
};
export type SupplierSummaryRuntime = {
  subscribe: (listener: () => void) => () => void;
  applySummary: (summary: SupplierSummary) => SupplierSummary;
  recordCreatedPending: () => void;
  recordUnannouncedDecision: (from: DispatchRecord['status'], to: DispatchRecord['status']) => void;
};

/** @v2 SupplierStore */
export class SupplierStore {
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribeRuntime: () => void;
  private version = 0;
  private _loadingSummary = false;
  private _loadingHistory = false;
  private _loadedSummary = false;
  private _loadedHistory = false;
  private _summaryError: unknown | null = null;
  private _historyError: unknown | null = null;
  private readonly _loadingBreakdown = new Map<SupplierStatusKind, boolean>();
  private readonly _breakdownErrors = new Map<SupplierStatusKind, unknown>();
  private readonly _breakdownItems = new Map<SupplierStatusKind, SupplierStatusBreakdownEntry[]>();
  private readonly _loadingDetail = new Map<string, boolean>();
  private readonly _detailErrors = new Map<string, unknown>();
  private readonly _detailItems = new Map<string, DispatchRecord[]>();
  private _summary: SupplierSummary = { pendingCount: 0, submittedCount: 0, returnedCount: 0 };
  private _historyItems: DispatchRecord[] = [];

  constructor(private readonly session: Session, private readonly api: SupplierStoreApi, private readonly runtime: SupplierSummaryRuntime) {
    this.unsubscribeRuntime = runtime.subscribe(() => this.notify());
  }
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = (): number => this.version;
  private notify(): void { this.version++; for (const listener of this.listeners) listener(); }
  dispose(): void { this.unsubscribeRuntime(); this.listeners.clear(); }
  get loadingSummary(): boolean { return this._loadingSummary; }
  get loadingHistory(): boolean { return this._loadingHistory; }
  get loadedSummary(): boolean { return this._loadedSummary; }
  get loadedHistory(): boolean { return this._loadedHistory; }
  get summaryError(): unknown | null { return this._summaryError; }
  get historyError(): unknown | null { return this._historyError; }
  get historyItems(): DispatchRecord[] { return this._historyItems; }
  get summary(): SupplierSummary {
    if (this._loadedSummary || !this._loadedHistory) return this.runtime.applySummary(this._summary);
    const counts = { pendingCount: 0, submittedCount: 0, returnedCount: 0 };
    for (const item of this._historyItems) {
      if (item.status === 'pending' || item.status === 'draft') counts.pendingCount++;
      else if (item.status === 'accepted') counts.submittedCount++;
      else counts.returnedCount++;
    }
    return this.runtime.applySummary(counts);
  }
  breakdownItems(kind: SupplierStatusKind): SupplierStatusBreakdownEntry[] { return this._breakdownItems.get(kind) ?? []; }
  loadingBreakdown(kind: SupplierStatusKind): boolean { return this._loadingBreakdown.get(kind) === true; }
  breakdownError(kind: SupplierStatusKind): unknown | null { return this._breakdownErrors.get(kind) ?? null; }
  detailItems(kind: SupplierStatusKind, itemCode: string): DispatchRecord[] { return this._detailItems.get(this.detailKey(kind, itemCode)) ?? []; }
  loadingDetail(kind: SupplierStatusKind, itemCode: string): boolean { return this._loadingDetail.get(this.detailKey(kind, itemCode)) === true; }
  detailError(kind: SupplierStatusKind, itemCode: string): unknown | null { return this._detailErrors.get(this.detailKey(kind, itemCode)) ?? null; }

  async bootstrapSummary(force = false): Promise<void> {
    if (this._loadingSummary || (this._loadedSummary && !force)) return;
    await this.refreshSummary();
  }
  async bootstrapHistory(force = false): Promise<void> {
    if (this._loadingHistory || (this._loadedHistory && !force)) return;
    await this.refreshHistory();
  }
  async refreshSummary(): Promise<void> {
    if (this._loadingSummary) return;
    this._loadingSummary = true; this._summaryError = null; this.notify();
    try { this._summary = await this.api.supplierSummary(this.session); this._loadedSummary = true; }
    catch (error) { this._summaryError = error; }
    finally { this._loadingSummary = false; this.notify(); }
  }
  async refreshHistory(): Promise<void> {
    if (this._loadingHistory) return;
    this._loadingHistory = true; this._historyError = null; this.notify();
    try { this._historyItems = await this.api.supplierHistory(this.session); this._loadedHistory = true; }
    catch (error) { this._historyError = error; }
    finally { this._loadingHistory = false; this.notify(); }
  }
  async refreshAll(): Promise<void> { await Promise.all([this.refreshSummary(), this.refreshHistory()]); }
  async bootstrapBreakdown(kind: SupplierStatusKind, force = false): Promise<void> {
    if (this.loadingBreakdown(kind) || (this._breakdownItems.has(kind) && !force)) return;
    await this.refreshBreakdown(kind);
  }
  async refreshBreakdown(kind: SupplierStatusKind): Promise<void> {
    if (this.loadingBreakdown(kind)) return;
    this._loadingBreakdown.set(kind, true); this._breakdownErrors.set(kind, null);
    // V2 does not notify listeners at the beginning of a breakdown request.
    try { this._breakdownItems.set(kind, await this.api.supplierStatusBreakdown(this.session, kind)); }
    catch (error) { this._breakdownErrors.set(kind, error); }
    finally { this._loadingBreakdown.set(kind, false); this.notify(); }
  }
  async bootstrapDetail(kind: SupplierStatusKind, itemCode: string, force = false): Promise<void> {
    const key = this.detailKey(kind, itemCode);
    if (this._loadingDetail.get(key) === true || (this._detailItems.has(key) && !force)) return;
    await this.refreshDetail(kind, itemCode);
  }
  async refreshDetail(kind: SupplierStatusKind, itemCode: string): Promise<void> {
    const key = this.detailKey(kind, itemCode);
    if (this._loadingDetail.get(key) === true) return;
    this._loadingDetail.set(key, true); this._detailErrors.set(key, null); this.notify();
    try { this._detailItems.set(key, await this.api.supplierStatusDetails(this.session, kind, itemCode)); }
    catch (error) { this._detailErrors.set(key, error); }
    finally { this._loadingDetail.set(key, false); this.notify(); }
  }
  recordCreatedPending(): void { this.runtime.recordCreatedPending(); }
  recordUnannouncedDecision(from: DispatchRecord['status'], to: DispatchRecord['status']): void {
    this.runtime.recordUnannouncedDecision(from, to);
  }
  private detailKey(kind: SupplierStatusKind, itemCode: string): string { return `${kind}:${trimNotificationText(itemCode)}`; }
  clear(): void {
    this._loadingSummary = false; this._loadingHistory = false; this._loadedSummary = false; this._loadedHistory = false;
    this._summaryError = null; this._historyError = null; this._loadingBreakdown.clear(); this._breakdownErrors.clear();
    this._breakdownItems.clear(); this._loadingDetail.clear(); this._detailErrors.clear(); this._detailItems.clear();
    this._summary = { pendingCount: 0, submittedCount: 0, returnedCount: 0 }; this._historyItems = []; this.notify();
  }
}
