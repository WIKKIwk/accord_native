import { trimDart } from './qolipApiCommon';
import { qolipPlacementSortLoadedProducts, type QolipCellProductPicker, type QolipPlacementProduct } from './qolipCellPlacement';

type State = { items: readonly QolipPlacementProduct[]; selected: ReadonlySet<string>;
  loading: boolean; loadingMore: boolean; hasMore: boolean; error: boolean };
const pageSize = 80;
const keyFor = (item: QolipPlacementProduct) => trimDart(item.qolip_code).toLowerCase();

/** M3 picker behavior for cell placement; the native views are separate. */
export class QolipCellPickerState {
  private value: State = { items: [], selected: new Set(), loading: true, loadingMore: false, hasMore: true, error: false };
  private readonly selectedItems = new Map<string, QolipPlacementProduct>();
  private readonly listeners = new Set<() => void>();
  private active = false;
  private picker: QolipCellProductPicker | null = null;
  private query = '';
  private request = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly makePicker: () => QolipCellProductPicker | null) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  get visibleItems() { return qolipPlacementSortLoadedProducts(this.value.items, this.query); }
  get selectedProducts() { return [...this.selectedItems.values()]; }
  private publish(patch: Partial<State>) {
    if (!this.active) return;
    this.value = { ...this.value, ...patch }; this.listeners.forEach(listener => listener());
  }
  activate() { if (!this.active) { this.active = true; this.picker = this.makePicker(); } }
  start(): Promise<void> { return this.reload(true); }
  setQuery(query: string) {
    if (!this.active) return;
    this.query = query;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.reload(true); }, 220);
  }
  retry(): Promise<void> { return this.reload(true); }
  loadMore(): Promise<void> {
    if (!this.active || this.value.loading || this.value.loadingMore || !this.value.hasMore) return Promise.resolve();
    return this.reload(false);
  }
  private async reload(reset: boolean): Promise<void> {
    if (!this.active) return;
    const request = ++this.request, picker = this.picker, query = trimDart(this.query);
    if (reset) this.publish({ items: [], loading: true, loadingMore: false, hasMore: true, error: false });
    else this.publish({ loadingMore: true });
    try {
      if (!picker) throw new Error('Qolip picker session changed');
      const result = await picker.loadPage(query, reset ? 0 : this.value.items.length, pageSize);
      if (!this.active || request !== this.request || picker !== this.picker) return;
      this.publish({ items: reset ? result : [...this.value.items, ...result], hasMore: result.length >= pageSize });
    } catch {
      if (this.active && request === this.request) this.publish({ error: true });
    } finally {
      if (this.active && request === this.request) this.publish({ loading: false, loadingMore: false });
    }
  }
  toggle(item: QolipPlacementProduct) {
    if (!this.active) return;
    const key = keyFor(item);
    if (this.selectedItems.has(key)) this.selectedItems.delete(key); else this.selectedItems.set(key, item);
    this.publish({ selected: new Set(this.selectedItems.keys()) });
  }
  /** A tap selects one item only when multi-select has not been entered. */
  tap(item: QolipPlacementProduct): QolipPlacementProduct | null {
    if (!this.active) return null;
    if (this.selectedItems.size) { this.toggle(item); return null; }
    return item;
  }
  dispose() {
    this.active = false; this.request++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.picker?.close(); this.picker = null; this.listeners.clear();
  }
}
