import type { SupplierItem } from '../shared/catalogApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import type { AdminItemGroupBulkMoveResult } from './itemGroupModel';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateMemoryCache } from './adminItemCreateCache';
import { adminItemCreateLoadMoreExtent, adminItemCreatePageSize, adminItemCreateSearchDelay, type AdminItemCreateNotice } from './adminItemCreateModel';
import { AdminItemCreateScope } from './adminItemCreateScope';

export type AdminItemCreateMovePrompt = Readonly<{ id: number; generation: number; codes: readonly string[]; group: string }>;
export type AdminItemCreateListSnapshot = Readonly<{ valid: boolean; searchDraft: string; query: string; group: string; items: readonly SupplierItem[];
  initialLoading: boolean; loadingMore: boolean; hasMore: boolean; error: unknown | null; selectedCodes: readonly string[];
  groupExpanded: boolean; moving: boolean; submittingMove: boolean; prompt: AdminItemCreateMovePrompt | null; notice: AdminItemCreateNotice | null; scrollReset: number }>;
type ListDeps = { isCurrent: () => boolean; namespace: string; cache: AdminItemCreateMemoryCache;
  page: (query: string, group: string, limit: number, offset: number, guard: () => void, witness: () => boolean) => Promise<readonly SupplierItem[]>;
  move: (codes: readonly string[], group: string, guard: () => void) => Promise<AdminItemGroupBulkMoveResult>;
  canSelect: () => boolean; canOpenItem: () => boolean; openItem: (item: SupplierItem) => Promise<void>;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>; clearTimer?: (timer: ReturnType<typeof setTimeout>) => void };

/** @v2 _AdminItemsListTabState */
export class AdminItemCreateListController {
  private state: AdminItemCreateListSnapshot = { valid: true, searchDraft: '', query: '', group: '', items: [], initialLoading: true, loadingMore: false, hasMore: false,
    error: null, selectedCodes: [], groupExpanded: false, moving: false, submittingMove: false, prompt: null, notice: null, scrollReset: 0 };
  private readonly scope: AdminItemCreateScope; private serial = 0; private promptSerial = 0; private noticeSerial = 0;
  private readonly selected = new Set<string>(); private timer: ReturnType<typeof setTimeout> | null = null; private choosing = false; private pendingMove: AdminItemCreateMovePrompt | null = null;
  private readonly listeners = new Set<() => void>(); private publishing = false;
  constructor(private readonly deps: ListDeps) { this.scope = new AdminItemCreateScope(deps.isCurrent); }
  get interactionGeneration() { return this.scope.interactionGeneration; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  isCurrent = (generation?: number) => this.scope.current(generation);
  private publish(patch: Partial<AdminItemCreateListSnapshot>) { this.state = { ...this.state, ...patch }; const previous = this.publishing; this.publishing = true;
    try { for (const listener of [...this.listeners]) listener(); } finally { this.publishing = previous; } }
  start() {
    if (this.scope.isActive) return;
    if (!this.scope.start()) { this.invalidate(); return; }
    const cached = this.deps.cache.readList(this.deps.namespace);
    if (cached) this.publish({ valid: true, searchDraft: cached.query, query: cached.query, group: cached.group, items: cached.items, hasMore: cached.hasMore,
      initialLoading: false, loadingMore: false, error: null, moving: false, submittingMove: false, prompt: null });
    else { this.publish({ valid: true }); void this.reload(); }
  }
  private cancelDebounce() { if (this.timer !== null) (this.deps.clearTimer ?? clearTimeout)(this.timer); this.timer = null; }
  changeSearch(value: string) {
    if (this.publishing || !this.isCurrent()) return; this.cancelDebounce(); const generation = this.interactionGeneration; this.publish({ searchDraft: value }); if (!this.isCurrent(generation)) return;
    this.timer = (this.deps.setTimer ?? setTimeout)(() => { this.timer = null; if (!this.isCurrent(generation)) return; this.publish({ query: dartTrim(value) }); void this.reload(); }, adminItemCreateSearchDelay);
  }
  async reload() {
    if (this.publishing || !this.isCurrent()) return; const serial = ++this.serial;
    this.publish({ items: [], initialLoading: true, loadingMore: false, hasMore: false, error: null });
    await this.fetch(serial, 0, true);
  }
  async loadMore() {
    if (this.publishing || !this.isCurrent() || this.state.initialLoading || this.state.loadingMore || !this.state.hasMore) return;
    const serial = this.serial, offset = this.state.items.length; this.publish({ loadingMore: true }); await this.fetch(serial, offset, false);
  }
  scroll(extentAfter: number) { if (extentAfter <= adminItemCreateLoadMoreExtent) void this.loadMore(); }
  private async fetch(serial: number, offset: number, replace: boolean) {
    const query = this.state.query, group = this.state.group, operation = this.scope.begin(() => serial === this.serial && query === this.state.query && group === this.state.group);
    const ticket = this.deps.cache.ticket(this.deps.namespace);
    try {
      operation.guard(); const page = await operation.wait(this.deps.page(query, group, adminItemCreatePageSize, offset, operation.guard, operation.current)); operation.guard();
      const items = replace ? Object.freeze([...page]) : Object.freeze([...this.state.items, ...page]); operation.guard();
      this.publish({ items, initialLoading: false, loadingMore: false, hasMore: page.length === adminItemCreatePageSize, error: null });
      if (operation.current()) this.deps.cache.writeList(ticket, { query, group, items, hasMore: page.length === adminItemCreatePageSize });
    } catch (error) { if (operation.current()) this.publish({ initialLoading: false, loadingMore: false, hasMore: false, error }); }
    finally { operation.expire(); }
  }
  toggleGroup() { if (!this.publishing && this.isCurrent() && !this.state.moving) this.publish({ groupExpanded: !this.state.groupExpanded }); }
  changeGroup(group: string) {
    if (this.publishing || !this.isCurrent() || this.state.moving) return; if (group === this.state.group) { this.publish({ groupExpanded: false }); return; }
    this.cancelDebounce(); this.deps.cache.clearList(this.deps.namespace);
    this.publish({ groupExpanded: false, query: dartTrim(this.state.searchDraft), group, scrollReset: this.state.scrollReset + 1 }); void this.reload();
  }
  toggleItem(item: SupplierItem) {
    if (this.publishing || !this.isCurrent() || this.state.moving || !isSynchronouslyTrue(this.deps.canSelect) || !this.isCurrent()) return;
    if (!this.selected.delete(item.code)) this.selected.add(item.code); this.publish({ selectedCodes: Object.freeze([...this.selected]) });
  }
  clearSelection() { if (this.publishing || !this.isCurrent() || this.state.moving) return; this.selected.clear(); this.publish({ selectedCodes: [] }); }
  async openItem(item: SupplierItem) {
    if (this.publishing || !this.isCurrent() || this.state.moving) return;
    if (isSynchronouslyTrue(this.deps.canSelect) && this.selected.size) { this.toggleItem(item); return; }
    if (!isSynchronouslyTrue(this.deps.canOpenItem) || !this.isCurrent()) return;
    const operation = this.scope.begin();
    try { operation.guard(); await operation.wait(this.deps.openItem(item)); operation.guard(); this.deps.cache.clearList(this.deps.namespace); await this.reload(); }
    catch { /* Source awaited navigation adds no new error surface. */ } finally { operation.expire(); }
  }
  requestMove() {
    if (this.publishing || this.choosing || !this.isCurrent() || this.state.moving || !this.selected.size || !isSynchronouslyTrue(this.deps.canSelect) || !this.isCurrent()) return;
    const group = dartTrim(this.state.group);
    if (!group) { this.publish({ groupExpanded: true, notice: { serial: ++this.noticeSerial, surface: 'snackbar', tone: 'error', key: 'bulk_move.select_group' } }); return; }
    this.publish({ moving: true, prompt: Object.freeze({ id: ++this.promptSerial, generation: this.interactionGeneration, codes: Object.freeze([...this.selected]), group }) });
  }
  /** The native host clears the original prompt before committing this returned ticket. */
  chooseMove(prompt: AdminItemCreateMovePrompt, confirmed: boolean): (() => Promise<void>) | null {
    if (this.publishing || this.choosing || this.state.prompt !== prompt || !this.isCurrent(prompt.generation)) return null; this.choosing = true;
    try {
      this.pendingMove = confirmed ? prompt : null; this.publish({ prompt: null, ...(confirmed ? {} : { moving: false, submittingMove: false }) });
      if (!confirmed || !this.isCurrent(prompt.generation)) return null;
      return () => this.commitMove(prompt);
    } finally { this.choosing = false; }
  }
  private async commitMove(prompt: AdminItemCreateMovePrompt) {
    if (this.pendingMove !== prompt || !this.isCurrent(prompt.generation)) return; this.pendingMove = null;
    if (!isSynchronouslyTrue(this.deps.canSelect) || !this.isCurrent(prompt.generation)) { this.publish({ moving: false, submittingMove: false }); return; }
    const operation = this.scope.begin(); this.publish({ submittingMove: true });
    try {
      operation.guard(); const result = await operation.wait(this.deps.move(prompt.codes, prompt.group, operation.guard)); operation.guard();
      this.deps.cache.clearList(this.deps.namespace);
      if (result.failed_count === 0) this.selected.clear(); else result.updated_item_codes.forEach(code => this.selected.delete(code)); operation.guard();
      this.publish({ selectedCodes: Object.freeze([...this.selected]), notice: { serial: ++this.noticeSerial, surface: 'snackbar', tone: 'success',
        key: result.failed_count === 0 ? 'bulk_move.success' : 'bulk_move.partial_success', values: result.failed_count === 0 ? { count: result.updated_count } : { updated: result.updated_count, failed: result.failed_count } } });
      if (operation.current()) await this.reload();
    } catch (error) { if (operation.current()) this.publish({ notice: { serial: ++this.noticeSerial, surface: 'snackbar', tone: 'error', key: 'bulk_move.failed', values: { error } } }); }
    finally { if (operation.current()) this.publish({ moving: false, submittingMove: false }); operation.expire(); }
  }
  dispose() { this.cancelDebounce(); this.pendingMove = null; this.scope.dispose(); this.serial++; this.publish({ prompt: null, moving: false, submittingMove: false }); }
  invalidate() { this.scope.invalidate(); this.cancelDebounce(); this.selected.clear(); this.pendingMove = null; this.publish({ valid: false, query: '', searchDraft: '', group: '',
    items: [], selectedCodes: [], prompt: null, moving: false, submittingMove: false, initialLoading: false, loadingMore: false, hasMore: false, error: null, notice: null }); }
}
