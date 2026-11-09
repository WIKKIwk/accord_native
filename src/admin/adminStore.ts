import type { DispatchRecord } from '../shared/notificationApi';
import { emptyAdminSupplierSummary, type AdminSupplierSummary } from './adminSupplierSummary';

export type AdminStoreSnapshot = { loadingSummary: boolean; loadedSummary: boolean; summaryError: unknown | null;
  summary: AdminSupplierSummary; loadingActivity: boolean; loadedActivity: boolean; activityError: unknown | null;
  activityItems: DispatchRecord[] };
function emptySnapshot(): AdminStoreSnapshot {
  return { loadingSummary: false, loadedSummary: false, summaryError: null, summary: emptyAdminSupplierSummary(),
    loadingActivity: false, loadedActivity: false, activityError: null, activityItems: [] };
}
/** @v2 AdminStore */
export class AdminStore {
  private state = emptySnapshot();
  private epoch = 0;
  private listeners = new Set<() => void>();
  constructor(private readonly readSummary: () => Promise<AdminSupplierSummary>,
    private readonly readActivity: () => Promise<DispatchRecord[]>) {}
  getSnapshot = (): AdminStoreSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private emit(patch: Partial<AdminStoreSnapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  async bootstrapSummary(force = false): Promise<void> {
    if (this.state.loadingSummary || (this.state.loadedSummary && !force)) return;
    await this.refreshSummary();
  }
  async bootstrapActivity(force = false): Promise<void> {
    if (this.state.loadingActivity || (this.state.loadedActivity && !force)) return;
    await this.refreshActivity();
  }
  async refreshSummary(): Promise<void> {
    if (this.state.loadingSummary) return;
    const epoch = this.epoch;
    this.emit({ loadingSummary: true, summaryError: null });
    try {
      const summary = await this.readSummary();
      if (epoch === this.epoch) this.state = { ...this.state, summary, loadedSummary: true };
    } catch (error) {
      if (epoch === this.epoch) this.state = { ...this.state, summaryError: error };
    } finally {
      if (epoch === this.epoch) this.emit({ loadingSummary: false });
    }
  }
  async refreshActivity(): Promise<void> {
    if (this.state.loadingActivity) return;
    const epoch = this.epoch;
    this.emit({ loadingActivity: true, activityError: null });
    try {
      const activityItems = await this.readActivity();
      if (epoch === this.epoch) this.state = { ...this.state, activityItems, loadedActivity: true };
    } catch (error) {
      if (epoch === this.epoch) this.state = { ...this.state, activityError: error };
    } finally {
      if (epoch === this.epoch) this.emit({ loadingActivity: false });
    }
  }
  async refreshAll(): Promise<void> { await Promise.all([this.refreshSummary(), this.refreshActivity()]); }
  clear(): void { this.epoch++; this.state = emptySnapshot(); for (const listener of this.listeners) listener(); }
}
