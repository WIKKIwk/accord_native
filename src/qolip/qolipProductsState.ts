import { qolipAdoptCatalogWindow, qolipContainerKey, groupQolipProductsByContainer, type QolipProductContainer } from './qolipProductContainer';
import type { QolipCatalogReadItem, QolipCatalogReadPage } from './qolipCatalogReadApi';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import type { QolipReworkEntry } from './qolipReworkApi';
import { trimDart } from './qolipApiCommon';
import type { QolipCatalogStore } from '../shared/qolipCatalogStore';

export type QolipCatalogProduct = QolipProductContainer['children'][number];
export type QolipProductsSnapshot = {
  invalid: boolean; loading: boolean; error: unknown; query: string; loadingMore: boolean; pageError: unknown;
  nextCursor: string | null; containers: readonly QolipProductContainer[]; expanded: string | null;
  detailPending: ReadonlySet<string>; detailErrors: ReadonlyMap<string, unknown>;
  selectionMode: 'containers' | 'qolips' | null; selectedContainers: ReadonlySet<string>;
  selectedCodes: ReadonlySet<string>; reworkCodes: ReadonlySet<string>;
  listRevision: number;
};
type Readers = { page: (input: { query: string; cursor: string | null }, current: () => boolean) => Promise<QolipCatalogReadPage>;
  details: (id: string, current: () => boolean) => Promise<readonly QolipCatalogProduct[]>;
  reworks: (current: () => boolean) => Promise<readonly QolipReworkEntry[]> };
export const qolipProductMoldKey = (p: QolipCatalogProduct) => `${trimDart(p.code).toLowerCase()}\u0000${trimDart(p.qolip_code).toLowerCase()}`;

/** @v2 _QolipProductsScreenState */
export class QolipProductsState {
  private active = false;
  private generation = 0;
  private selectionGeneration = 0;
  private reworkRevision = 0;
  private query = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeCatalog: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private items: readonly QolipCatalogReadItem[] = [];
  private details = new Map<string, readonly QolipCatalogProduct[]>();
  private requests = new Map<string, Promise<QolipProductContainer | null>>();
  private windows = new Map<string, { items: readonly QolipCatalogReadItem[]; cursor: string | null; details: Map<string, readonly QolipCatalogProduct[]> }>();
  private value: QolipProductsSnapshot = { invalid: false, loading: true, error: null, query: '', loadingMore: false,
    pageError: null, nextCursor: null, containers: [], expanded: null, detailPending: new Set(), detailErrors: new Map(),
    selectionMode: null, selectedContainers: new Set(), selectedCodes: new Set(), reworkCodes: new Set(), listRevision: 0 };
  constructor(private boundary: QolipHomeReadBoundary, private readers: Readers, private catalog?: QolipCatalogStore) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  current = () => {
    if (!this.active || this.value.invalid) return false;
    try { if (this.boundary.current()) return true; } catch { /* Retire the original owner. */ }
    this.invalidate(); return false;
  };
  private patch(patch: Partial<QolipProductsSnapshot>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(fn => fn()); }
  activate() { if (this.active) return; this.active = true; this.unsubscribe = this.boundary.subscribe(() => { this.current(); });
    this.unsubscribeCatalog = this.catalog?.subscribe(() => { if (!this.current()) return;
      if (!this.catalog!.window(this.query).loaded) { void this.reload(false); return; }
      this.selectionGeneration++; this.adoptStore(); this.patch({ selectedCodes: new Set(), selectedContainers: new Set(), selectionMode: null, detailErrors: new Map() });
    }) ?? null; void this.reload(false, null, true); }
  dispose() { this.active = false; this.generation++; this.selectionGeneration++; if (this.timer) clearTimeout(this.timer); this.unsubscribe?.(); this.unsubscribe = null; this.unsubscribeCatalog?.(); this.unsubscribeCatalog = null; }
  private invalidate() { if (this.value.invalid) return; this.dispose(); this.items = []; this.details.clear(); this.windows.clear(); this.patch({ invalid: true, containers: [], selectedCodes: new Set(), selectedContainers: new Set(), detailPending: new Set() }); }
  private adopt() { const projection = qolipAdoptCatalogWindow(this.items, this.details); this.patch({ containers: projection.containers }); }
  private adoptStore() { if (!this.catalog) return; const window = this.catalog.window(this.query); this.items = window.items;
    this.details.clear(); for (const row of this.items) { const products = this.catalog.details(row.id); if (products) this.details.set(row.id, products); }
    this.patch({ nextCursor: window.nextCursor }); this.adopt(); }
  private remember(query: string) { this.windows.set(query, { items: this.items, cursor: this.value.nextCursor, details: new Map(this.details) }); }
  setSearch(query: string) {
    if (!this.current()) return; if (this.timer) clearTimeout(this.timer);
    this.generation++; this.patch({ query });
    if (!trimDart(query)) void this.reload(false);
    else this.timer = setTimeout(() => { this.timer = null; void this.reload(false); }, 250);
  }
  get scrollOffset() { return this.catalog?.window(this.query).scrollOffset ?? 0; }
  setScrollOffset(value: number) { if (this.current() && this.catalog) this.catalog.window(this.query).scrollOffset = value; }
  async reload(force = true, expanded: string | null = null, refreshReworks = false) {
    if (!this.current()) return;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    const generation = ++this.generation, query = trimDart(this.value.query), revision = this.reworkRevision;
    this.query = query;
    this.selectionGeneration++; this.requests.clear(); this.details.clear();
    this.patch({ selectedCodes: new Set(), selectedContainers: new Set(), selectionMode: null, detailPending: new Set(), detailErrors: new Map(),
      pageError: null, loadingMore: false, expanded, error: null });
    if (force) { this.windows.clear(); this.catalog?.reset(); }
    if (!refreshReworks && this.catalog && this.catalog.window(query).loaded) { this.adoptStore(); this.patch({ loading: false }); return; }
    const cached = this.windows.get(query);
    if (!refreshReworks && cached) { this.items = cached.items; this.details = new Map(cached.details); this.patch({ loading: false, nextCursor: cached.cursor }); this.adopt(); return; }
    this.items = []; this.patch({ loading: true, containers: [], nextCursor: null, listRevision: this.value.listRevision + 1 });
    const current = () => this.current() && generation === this.generation;
    try {
      const [page, reworks] = await Promise.all([this.catalog ? this.catalog.first(query).then(window => ({ items: window.items, next_cursor: window.nextCursor })) : this.readers.page({ query, cursor: null }, current), this.readers.reworks(current)]);
      if (!current()) return;
      this.items = page.items;
      this.patch({ loading: false, nextCursor: page.next_cursor,
        ...(revision === this.reworkRevision ? { reworkCodes: new Set(reworks.map(row => trimDart(row.qolip_code).toLowerCase())) } : {}) });
      if (this.catalog) this.adoptStore(); else { this.adopt(); this.remember(query); }
      if (expanded) { const row = this.value.containers.find(row => qolipContainerKey(row) === expanded); if (row) await this.ensureDetails(row); }
    } catch (error) { if (current()) this.patch({ loading: false, error }); }
  }
  async more() {
    if (!this.current() || this.value.loadingMore || !this.value.nextCursor || this.value.loading || trimDart(this.value.query) !== this.query) return;
    const generation = this.generation, query = trimDart(this.value.query), cursor = this.value.nextCursor;
    const current = () => this.current() && generation === this.generation;
    this.patch({ loadingMore: true, pageError: null });
    try {
      if (this.catalog) { await this.catalog.more(query); if (current()) this.adoptStore(); return; }
      const page = await this.readers.page({ query, cursor }, current); if (!current()) return;
      const ids = new Set(this.items.map(row => row.id));
      if (page.items.some(row => ids.has(row.id))) throw new TypeError('Invalid Qolip catalog page');
      this.items = [...this.items, ...page.items]; this.patch({ nextCursor: page.next_cursor }); this.adopt(); this.remember(query);
    } catch (error) { if (current()) this.patch({ pageError: error }); }
    finally { if (current()) this.patch({ loadingMore: false }); }
  }
  async ensureDetails(container: QolipProductContainer): Promise<QolipProductContainer | null> {
    if (!this.current()) return null;
    const id = qolipContainerKey(container), cached = this.details.get(id);
    if (cached) return this.value.containers.find(row => qolipContainerKey(row) === id) ?? null;
    const pending = this.requests.get(id); if (pending) return pending;
    const generation = this.generation, current = () => this.current() && generation === this.generation;
    const errors = new Map(this.value.detailErrors); errors.delete(id);
    this.patch({ detailPending: new Set([...this.value.detailPending, id]), detailErrors: errors });
    const request = (async () => {
      try {
        const products = this.catalog ? await this.catalog.loadDetails(id) : await this.readers.details(id, current); if (!current()) return null;
        if (groupQolipProductsByContainer(products).length !== 1) throw new TypeError('Invalid Qolip product details');
        this.details.set(id, products); this.adopt(); this.remember(this.query);
        return this.value.containers.find(row => qolipContainerKey(row) === id) ?? null;
      } catch (error) {
        if (current()) this.patch({ detailErrors: new Map([...this.value.detailErrors, [id, error]]), expanded: id }); return null;
      } finally {
        if (current()) { this.requests.delete(id); const pending = new Set(this.value.detailPending); pending.delete(id); this.patch({ detailPending: pending }); }
      }
    })();
    this.requests.set(id, request); return request;
  }
  async toggleExpanded(row: QolipProductContainer) { if (!this.current()) return; const key = qolipContainerKey(row), closing = this.value.expanded === key; this.patch({ expanded: closing ? null : key }); if (!closing) await this.ensureDetails(row); }
  cancelSelection() { if (!this.current()) return; this.selectionGeneration++; this.patch({ selectionMode: null, selectedCodes: new Set(), selectedContainers: new Set() }); }
  async toggleContainer(row: QolipProductContainer) {
    if (!this.current()) return;
    const generation = this.selectionGeneration, resolved = await this.ensureDetails(row);
    if (!resolved || !this.current() || generation !== this.selectionGeneration || resolved.children.some(p => p.is_in_use || this.value.reworkCodes.has(trimDart(p.qolip_code).toLowerCase())) || (this.value.selectionMode && this.value.selectionMode !== 'containers')) return;
    const containers = new Set(this.value.selectedContainers), codes = new Set(this.value.selectedCodes), key = qolipContainerKey(resolved);
    if (containers.has(key)) { containers.delete(key); resolved.children.forEach(p => codes.delete(qolipProductMoldKey(p))); }
    else { containers.add(key); resolved.children.forEach(p => codes.add(qolipProductMoldKey(p))); }
    this.patch({ selectedContainers: containers, selectedCodes: codes, selectionMode: containers.size ? 'containers' : null });
  }
  toggleMold(product: QolipCatalogProduct) {
    if (!this.current() || !trimDart(product.qolip_code) || product.is_in_use || this.value.reworkCodes.has(trimDart(product.qolip_code).toLowerCase()) || (this.value.selectionMode && this.value.selectionMode !== 'qolips')) return;
    const codes = new Set(this.value.selectedCodes), key = qolipProductMoldKey(product); if (codes.has(key)) codes.delete(key); else codes.add(key);
    this.patch({ selectedCodes: codes, selectionMode: codes.size ? 'qolips' : null });
  }
  selectedProducts() { return this.value.containers.flatMap(row => row.children).filter(p => this.value.selectedCodes.has(qolipProductMoldKey(p))); }
  reworkAccepted(rows: readonly QolipReworkEntry[]) { if (!this.current()) return; this.reworkRevision++; this.patch({ reworkCodes: new Set([...this.value.reworkCodes, ...rows.map(row => trimDart(row.qolip_code).toLowerCase())]) }); this.cancelSelection(); }
}
