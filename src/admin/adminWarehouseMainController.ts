import type { qolipProductFromJson } from '../qolipCatalogApi';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { AdminWarehouseFilterStore } from './adminWarehouseFilterStore';
import { adminWarehouseMainAvailableStock, adminWarehouseMainIsQolip, adminWarehouseMainQolipGroups, adminWarehouseMainReservedCount, adminWarehouseMainReservedStock } from './adminWarehouseMainModel';
import type { AdminWarehouseMainDetail, AdminWarehouseMainSummary } from './adminWarehouseMainReadTypes';
import type { AdminWarehouseStockItem } from './warehouseStockApi';
import { dartPartialLower, dartTrim } from './dartJsonString';

type Product = ReturnType<typeof qolipProductFromJson>;
type Phase = 'idle' | 'loading' | 'ready' | 'error';
type Guard = () => void;
type Witness = () => boolean;
export type AdminWarehouseMainState = {
  valid: boolean; summaryPhase: Phase; summary: AdminWarehouseMainSummary; summaryError: unknown;
  warehouse: string | null; filterExpanded: boolean; pageTab: 'products' | 'settings'; stockTab: 'available' | 'reserved';
  detailPhase: Phase; detail: AdminWarehouseMainDetail | null; detailError: unknown;
  search: string; query: string; items: readonly AdminWarehouseStockItem[]; qolipProducts: readonly Product[];
  itemsLoading: boolean; loadingMore: boolean; hasMore: boolean; itemsError: unknown; scrollReset: number;
};
export type AdminWarehouseMainDependencies = {
  isCurrent: Witness; canInteract?: Witness; adminScoped: boolean; preferences: AdminWarehouseFilterStore;
  summary: (guard: Guard, witness: Witness) => Promise<AdminWarehouseMainSummary>;
  detail: (warehouse: string, guard: Guard, witness: Witness) => Promise<AdminWarehouseMainDetail | null>;
  items: (warehouse: string, query: string, offset: number, guard: Guard, witness: Witness) => Promise<readonly AdminWarehouseStockItem[]>;
  qolipProducts: (query: string, guard: Guard, witness: Witness) => Promise<readonly Product[]>;
};
const initial = (warehouse: string | null): AdminWarehouseMainState => ({ valid: true, summaryPhase: 'idle', summary: { sections: [], qolipWarehouseNames: [] }, summaryError: null,
  warehouse, filterExpanded: false, pageTab: 'products', stockTab: 'available', detailPhase: 'idle', detail: null, detailError: null,
  search: '', query: '', items: [], qolipProducts: [], itemsLoading: false, loadingMore: false, hasMore: false, itemsError: null, scrollReset: 0 });

/** V2 AdminWarehousesScreen parent + _WarehouseDetailsTab read/search owners. No native presentation or commands. */
export class AdminWarehouseMainController {
  private state: AdminWarehouseMainState;
  private listeners = new Set<() => void>(); private active = false; private retired = false;
  private lifetime = 0; private summaryGeneration = 0; private detailGeneration = 0; private itemsGeneration = 0; private searchGeneration = 0; private selectionGeneration = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private manuallySelected = false; private itemsInitialized = false; private loadedWarehouse: string | null = null; private loadedQolip = false;
  private summaryPromise: Promise<AdminWarehouseMainSummary> | null = null;
  constructor(private readonly deps: AdminWarehouseMainDependencies) { this.state = initial(deps.preferences.cachedWarehouse); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<AdminWarehouseMainState>) { if (!this.active) return; this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private current(lifetime = this.lifetime): boolean {
    if (!this.active || this.retired || lifetime !== this.lifetime) return false;
    if (!isSynchronouslyTrue(this.deps.isCurrent)) { this.invalidate(); return false; }
    return this.active && !this.retired && lifetime === this.lifetime;
  }
  private interact() { return this.current() && (!this.deps.canInteract || isSynchronouslyTrue(this.deps.canInteract)); }
  private boundary(lifetime = this.lifetime, operation: Witness = () => true) {
    const witness = () => this.current(lifetime) && operation() && this.current(lifetime);
    return { witness, guard: () => { if (!witness()) throw new Error('Warehouse read owner changed'); } };
  }
  private clearSearch() { this.searchGeneration++; if (this.searchTimer !== undefined) clearTimeout(this.searchTimer); this.searchTimer = undefined; }
  private qolip(): boolean { return adminWarehouseMainIsQolip(this.state.warehouse, this.state.summary.qolipWarehouseNames, this.deps.adminScoped); }
  start(): void {
    if (this.active || this.retired) return; this.active = true; this.lifetime++;
    if (!this.current()) return;
    void this.loadSummary().catch(() => {}); void this.restorePreference();
  }
  dispose(): void {
    this.clearSearch(); this.active = false; this.lifetime++; this.summaryGeneration++; this.detailGeneration++; this.itemsGeneration++; this.itemsInitialized = false;
    this.state = { ...this.state, detailPhase: 'idle' };
  }
  invalidate(): void {
    if (this.retired) return; this.retired = true; this.clearSearch(); this.lifetime++; this.summaryGeneration++; this.detailGeneration++; this.itemsGeneration++;
    this.publish({ ...initial(null), valid: false });
  }
  private async loadSummary(): Promise<AdminWarehouseMainSummary> {
    const lifetime = this.lifetime, generation = ++this.summaryGeneration;
    const { guard, witness } = this.boundary(lifetime, () => generation === this.summaryGeneration); guard();
    this.publish({ summaryPhase: 'loading', summaryError: null });
    const pending = (async () => {
      try {
        guard(); const summary = await this.deps.summary(guard, witness); guard();
        this.publish({ summary, summaryPhase: 'ready' }); guard(); this.synchronizeSelection(summary);
        return summary;
      } catch (error) {
        if (witness()) { this.itemsInitialized = false; this.itemsGeneration++; this.clearSearch(); this.publish({ summaryPhase: 'error', summaryError: error }); }
        throw error;
      }
    })();
    if (generation === this.summaryGeneration) this.summaryPromise = pending;
    return pending;
  }
  private synchronizeSelection(summary: AdminWarehouseMainSummary) {
    if (!this.current()) return;
    const target = this.deps.preferences.resolveWarehouse(summary.sections.map(row => row.warehouse), this.state.warehouse ?? this.deps.preferences.cachedWarehouse);
    if (target !== null) {
      if (this.state.warehouse !== target || this.state.detailPhase === 'idle') this.applyWarehouse(target);
    } else if (this.manuallySelected) this.applyWarehouse(null);
    const warehouse = this.state.warehouse, qolip = this.qolip();
    if (!this.itemsInitialized || warehouse !== this.loadedWarehouse || qolip !== this.loadedQolip) {
      const existed = this.itemsInitialized;
      this.clearSearch(); this.publish({ ...(existed ? { search: '' } : { stockTab: 'available' as const }), query: '' }); void this.loadFirstItemsPage();
    }
  }
  private async restorePreference(): Promise<void> {
    const lifetime = this.lifetime, { witness } = this.boundary(lifetime);
    try {
      const saved = await this.deps.preferences.loadSavedWarehouse(witness);
      if (!witness() || this.manuallySelected || !saved || !this.summaryPromise) return;
      const summary = await this.summaryPromise;
      if (!witness() || this.manuallySelected) return;
      const target = this.deps.preferences.resolveWarehouse(summary.sections.map(row => row.warehouse), saved);
      if (target !== null && target !== this.state.warehouse) {
        if (this.applyWarehouse(target)) { this.clearSearch(); this.publish({ search: '', query: '' }); void this.loadFirstItemsPage(); }
      }
    } catch { /* Preference recovery never replaces the source summary error state. */ }
  }
  private applyWarehouse(warehouse: string | null): boolean {
    if (!this.current()) return false;
    const changed = warehouse !== this.state.warehouse, selection = ++this.selectionGeneration;
    const changedKey = dartPartialLower(dartTrim(warehouse ?? '')) !== this.selectionKey;
    this.publish({ warehouse, filterExpanded: false, ...(changed ? { detail: null, detailPhase: 'idle' as const } : {}), ...(changedKey ? { stockTab: 'available' as const } : {}) });
    if (!this.current() || selection !== this.selectionGeneration) return false;
    if (warehouse) void this.loadDetail(warehouse); else { this.detailGeneration++; this.publish({ detail: null, detailPhase: 'idle', detailError: null }); }
    return this.current() && selection === this.selectionGeneration;
  }
  selectWarehouse(warehouse: string): void {
    if (!this.interact()) return; const name = dartTrim(warehouse), { witness } = this.boundary(); this.manuallySelected = true;
    void this.deps.preferences.saveWarehouse(name, witness);
    if (!witness()) return;
    const changed = name !== this.state.warehouse;
    if (this.applyWarehouse(name) && changed) { this.clearSearch(); this.publish({ search: '', query: '' }); void this.loadFirstItemsPage(); }
  }
  toggleFilter(): void { if (this.interact()) this.publish({ filterExpanded: !this.state.filterExpanded }); }
  setPageTab(pageTab: 'products' | 'settings'): void { if (this.interact()) this.publish({ pageTab }); }
  setStockTab(stockTab: 'available' | 'reserved'): void {
    if (this.interact() && (stockTab === 'available' || adminWarehouseMainReservedCount(this.state.detail?.rawStock ?? [], this.state.detail?.reservations ?? []) > 0)) this.publish({ stockTab });
  }
  private async loadDetail(warehouse: string): Promise<void> {
    const generation = ++this.detailGeneration, { guard, witness } = this.boundary(this.lifetime, () => generation === this.detailGeneration && warehouse === this.state.warehouse);
    try {
      guard(); this.publish({ detailPhase: 'loading', detailError: null }); guard();
      const detail = await this.deps.detail(warehouse, guard, witness); guard();
      const before = adminWarehouseMainReservedCount(this.state.detail?.rawStock ?? [], this.state.detail?.reservations ?? []) > 0;
      const after = adminWarehouseMainReservedCount(detail?.rawStock ?? [], detail?.reservations ?? []) > 0;
      this.publish({ detail, detailPhase: 'ready', ...(before !== after ? { stockTab: 'available' as const } : {}) });
    } catch (error) { if (witness()) this.publish({ detailPhase: 'error', detailError: error }); }
  }
  /** Source _reload refreshes summary + selected raw detail; product paging is a separate retained child. */
  reload = async (): Promise<void> => {
    if (!this.current()) return;
    const summary = this.loadSummary(), warehouse = this.state.warehouse;
    if (dartTrim(warehouse ?? '')) void this.loadDetail(warehouse!);
    await summary;
  };
  /** Source live refresh only replaces the summary future. */
  refreshInPlace = async (): Promise<void> => { if (this.current()) await this.loadSummary(); };
  warehouseDeleted = async (): Promise<void> => {
    if (!this.current()) return; const { witness } = this.boundary(); this.deps.preferences.clearCache(witness); void this.deps.preferences.saveWarehouse('', witness);
    if (!witness() || !this.applyWarehouse(null)) return; this.clearSearch(); this.publish({ search: '', query: '' }); void this.loadFirstItemsPage(); await this.loadSummary();
  };
  search(value: string): void {
    if (!this.interact()) return; this.clearSearch(); const lifetime = this.lifetime, generation = this.searchGeneration;
    this.publish({ search: value }); if (!this.current(lifetime) || generation !== this.searchGeneration) return;
    // The source header survives its FutureBuilder, but its keyed product child has no search callback until mounted.
    if (!this.itemsInitialized) return;
    this.searchTimer = setTimeout(() => {
      if (!this.current(lifetime) || generation !== this.searchGeneration) return;
      this.searchTimer = undefined; this.publish({ query: dartTrim(value) }); if (this.current(lifetime) && generation === this.searchGeneration) void this.loadFirstItemsPage();
    }, 220);
  }
  clearSearchText(): void { this.search(''); }
  private async loadFirstItemsPage(): Promise<void> {
    if (!this.current()) return;
    const warehouse = dartTrim(this.state.warehouse ?? ''), generation = ++this.itemsGeneration;
    this.itemsInitialized = true; this.loadedWarehouse = this.state.warehouse; this.loadedQolip = this.qolip();
    this.publish({ items: [], qolipProducts: [], itemsLoading: !!warehouse, loadingMore: false, hasMore: false, itemsError: null, scrollReset: this.state.scrollReset + 1 });
    if (warehouse) await this.fetchItemsPage(warehouse, 0, generation, true, this.loadedQolip);
  }
  retryItems = (): Promise<void> => this.loadFirstItemsPage();
  loadMoreItems = async (): Promise<void> => {
    if (!this.current() || this.state.itemsLoading || this.state.loadingMore || !this.state.hasMore) return;
    const warehouse = dartTrim(this.state.warehouse ?? ''); if (!warehouse) return;
    const generation = this.itemsGeneration, offset = this.state.items.length;
    this.publish({ loadingMore: true, itemsError: null }); await this.fetchItemsPage(warehouse, offset, generation, false, false);
  };
  private async fetchItemsPage(warehouse: string, offset: number, generation: number, replace: boolean, qolip: boolean): Promise<void> {
    const query = this.state.query, { guard, witness } = this.boundary(this.lifetime, () => generation === this.itemsGeneration && query === this.state.query && warehouse === dartTrim(this.state.warehouse ?? '') && qolip === this.qolip());
    try {
      guard(); const rows = qolip ? await this.deps.qolipProducts(query, guard, witness) : await this.deps.items(warehouse, query, offset, guard, witness); guard();
      if (qolip) this.publish({ qolipProducts: rows as readonly Product[], itemsLoading: false, loadingMore: false, hasMore: false, itemsError: null });
      else this.publish({ items: replace ? rows as readonly AdminWarehouseStockItem[] : [...this.state.items, ...rows as readonly AdminWarehouseStockItem[]], itemsLoading: false, loadingMore: false, hasMore: rows.length === 80, itemsError: null });
    } catch (error) { if (witness()) this.publish({ itemsLoading: false, loadingMore: false, itemsError: error, ...(qolip ? { qolipProducts: [], hasMore: false } : {}) }); }
  }
  get isQolipWarehouse(): boolean { return this.qolip(); }
  get selectionKey(): string { return dartPartialLower(dartTrim(this.state.warehouse ?? '')); }
  get productsView() {
    const stock = this.state.detail?.rawStock ?? [], reservations = this.state.detail?.reservations ?? [];
    const availableRawStock = adminWarehouseMainAvailableStock(stock), reservedRawStock = adminWarehouseMainReservedStock(stock);
    const qolip = this.qolip(), groups = qolip ? adminWarehouseMainQolipGroups(this.state.qolipProducts) : [];
    const summary = this.state.summary.sections.find(row => dartPartialLower(dartTrim(row.warehouse)) === this.selectionKey);
    return { qolip, groups, availableRawStock, reservedRawStock, availableCount: qolip ? groups.length : summary?.product_count ?? this.state.items.length + availableRawStock.length,
      reservedCount: adminWarehouseMainReservedCount(stock, reservations), hasReserved: reservations.length > 0 || reservedRawStock.length > 0 };
  }
}
