import type { AdminItemCreateMemoryCache } from './adminItemCreateCache';
import { adminItemCreateSortedPicker, type AdminItemCreateNotice } from './adminItemCreateModel';
import { AdminItemCreateScope } from './adminItemCreateScope';
import { dartTrim } from './dartJsonString';

export type AdminItemCreatePickerSnapshot<T> = Readonly<{ query: string; searchDraft: string; items: readonly T[]; loading: boolean; loadingMore: boolean;
  hasMore: boolean; error: unknown | null; runningEmptyAction: boolean; closing: boolean; notice: AdminItemCreateNotice | null }>;
type PickerDeps<T> = { isCurrent: () => boolean; fetch: (query: string, limit: number, offset: number, guard: () => void, witness: () => boolean) => Promise<readonly T[]>;
  title: (item: T) => string; subtitle: (item: T) => string; onClosed: (item: T | null) => void;
  create?: (query: string) => Promise<T | null>; cache?: { store: AdminItemCreateMemoryCache; namespace: string; isCustomer: (item: T) => item is T & { ref: string; name: string; phone: string } };
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>; clearTimer?: (timer: ReturnType<typeof setTimeout>) => void };

/** Single-query M3AsyncPicker used here: no scan, AI, multi-query or multi-select paths are enabled by source. */
export class AdminItemCreatePickerController<T> {
  private readonly scope: AdminItemCreateScope; private readonly listeners = new Set<() => void>(); private serial = 0; private noticeSerial = 0;
  private timer: ReturnType<typeof setTimeout> | null = null; private outcome: { item: T | null } | null = null; private publishing = false;
  private state: AdminItemCreatePickerSnapshot<T> = { query: '', searchDraft: '', items: [], loading: true, loadingMore: false, hasMore: false,
    error: null, runningEmptyAction: false, closing: false, notice: null };
  constructor(private readonly deps: PickerDeps<T>) { this.scope = new AdminItemCreateScope(deps.isCurrent); }
  get interactionGeneration() { return this.scope.interactionGeneration; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isCurrent = (generation?: number) => this.scope.current(generation);
  get sortedItems() { return adminItemCreateSortedPicker(this.state.items, this.state.query, this.deps.title, this.deps.subtitle); }
  get canCreate() { return !!this.deps.create && !this.state.runningEmptyAction && !this.state.closing; }
  private publish(patch: Partial<AdminItemCreatePickerSnapshot<T>>) { this.state = { ...this.state, ...patch }; const previous = this.publishing; this.publishing = true;
    try { for (const listener of [...this.listeners]) listener(); } finally { this.publishing = previous; } }
  private interactive() { return !this.publishing && !this.state.closing && this.isCurrent(); }
  start() {
    if (this.scope.isActive) return; if (!this.scope.start()) return;
    const cached = this.deps.cache?.store.readCustomers(this.deps.cache.namespace);
    if (cached) this.publish({ query: '', searchDraft: '', items: cached.items as readonly T[], hasMore: cached.hasMore, loading: false, loadingMore: false, error: null, closing: false, runningEmptyAction: false });
    else { this.publish({ closing: false, runningEmptyAction: false }); void this.reload(); }
  }
  private cancelDebounce() { if (this.timer !== null) (this.deps.clearTimer ?? clearTimeout)(this.timer); this.timer = null; }
  search(value: string) {
    if (!this.interactive()) return; this.cancelDebounce(); const generation = this.interactionGeneration;
    // Source updates its backing query without setState. Native input owns its
    // immediate text; results/relevance/empty-action UI rebuild on the debounce.
    this.state = { ...this.state, searchDraft: value, query: value }; if (!this.isCurrent(generation)) return;
    this.timer = (this.deps.setTimer ?? setTimeout)(() => { this.timer = null; if (!this.isCurrent(generation) || this.state.closing) return;
      void this.reload(); }, 220);
  }
  async reload() {
    if (!this.isCurrent() || this.state.closing) return; const serial = ++this.serial;
    this.publish({ items: [], loading: true, loadingMore: false, hasMore: true, error: null }); await this.fetch(serial, 0, true);
  }
  async loadMore() {
    if (!this.interactive() || this.state.loading || this.state.loadingMore || !this.state.hasMore) return;
    const offset = this.state.items.length; this.publish({ loadingMore: true }); await this.fetch(this.serial, offset, false);
  }
  scroll(extentAfter: number) { if (extentAfter <= 240) void this.loadMore(); }
  private async fetch(serial: number, offset: number, replace: boolean) {
    const query = dartTrim(this.state.query), operation = this.scope.begin(() => serial === this.serial && !this.state.closing);
    const cache = this.deps.cache, ticket = cache?.store.ticket(cache.namespace, 'customers');
    try {
      operation.guard(); const page = await operation.wait(this.deps.fetch(query, 50, offset, operation.guard, operation.current)); operation.guard();
      const items = Object.freeze(replace ? [...page] : [...this.state.items, ...page]), hasMore = page.length >= 50;
      this.publish({ items, hasMore, loading: false, loadingMore: false, ...(replace ? { error: null } : {}) }); operation.guard();
      if (!query && page.length && cache && ticket && page.every(cache.isCustomer)) cache.store.writeCustomers(ticket, { items: page.filter(cache.isCustomer), hasMore });
    } catch (error) { if (operation.current()) this.publish({ loading: false, loadingMore: false, error }); }
    finally { operation.expire(); }
  }
  select(item: T) { if (this.interactive() && this.state.items.includes(item)) this.close(item); }
  dismiss() { if (this.interactive()) this.close(null); }
  private close(item: T | null) { this.outcome = { item }; this.cancelDebounce(); this.serial++; this.publish({ closing: true, runningEmptyAction: false }); }
  /** The genuine native sheet must acknowledge its original dismissal before delivering selection. */
  completeClose() {
    if (this.publishing || !this.state.closing || !this.outcome || !this.isCurrent()) return;
    const outcome = this.outcome; this.outcome = null; this.scope.dispose(); this.deps.onClosed(outcome.item);
  }
  async create() {
    if (!this.interactive() || !this.canCreate || !this.deps.create) return; const operation = this.scope.begin(() => !this.state.closing);
    this.publish({ runningEmptyAction: true });
    try { operation.guard(); const item = await operation.wait(this.deps.create(dartTrim(this.state.query))); operation.guard(); if (item !== null) this.close(item); }
    catch { if (operation.current()) this.publish({ notice: { serial: ++this.noticeSerial, getter: 'serverDisconnectedRetry', surface: 'snackbar', tone: 'error' } }); }
    finally { if (operation.current()) this.publish({ runningEmptyAction: false }); operation.expire(); }
  }
  dispose() { this.cancelDebounce(); this.serial++; this.outcome = null; this.scope.dispose(); }
  invalidate() { this.scope.invalidate(); this.dispose(); this.publish({ items: [], query: '', searchDraft: '', closing: true, loading: false, loadingMore: false, runningEmptyAction: false, error: null, notice: null }); }
}
