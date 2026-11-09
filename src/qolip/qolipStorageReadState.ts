import { MobileApiException } from '../shared/mobileApiException';
import { trimDart, type QolipReadGuard } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';
import type { QolipArchiveEntry, QolipArchiveInput, QolipPaddon, QolipStoragePage } from './qolipStorageApi';

export type QolipArchiveKind = 'all' | 'paddon' | 'qolip';
export type QolipStorageDateRange = Readonly<{ from: Date; to: Date }>;
type Snapshot = Readonly<{
  invalid: boolean; query: string; paddons: readonly QolipPaddon[]; archive: readonly QolipArchiveEntry[];
  visibleArchive: readonly QolipArchiveEntry[]; next: number | null; loading: boolean; loadingMore: boolean;
  searchPending: boolean; error: unknown | null; moreFailure: boolean; history: boolean; kind: QolipArchiveKind;
  warehouse: string; dates: QolipStorageDateRange | null; warehouses: readonly string[];
  warehouseExpanded: boolean; warehouseLoading: boolean; kindExpanded: boolean; saving: boolean;
}>;
type Dependencies = {
  archive: (input: QolipArchiveInput, guard: QolipReadGuard) => Promise<QolipStoragePage<QolipArchiveEntry>>;
  paddons: (input: { query: string; offset: number }, guard: QolipReadGuard) => Promise<QolipStoragePage<QolipPaddon>>;
  warehouses: (guard: QolipReadGuard) => Promise<readonly string[]>;
  scheduleFrame: (callback: () => void) => void;
};
const empty: Snapshot = Object.freeze({ invalid: true, query: '', paddons: [], archive: [], visibleArchive: [], next: null,
  loading: false, loadingMore: false, searchPending: false, error: null, moreFailure: false, history: false, kind: 'all',
  warehouse: '', dates: null, warehouses: [], warehouseExpanded: false, warehouseLoading: false, kindExpanded: false, saving: false });

/** Read/filter/pagination portion of _QolipStorageScreenState; no action owner or mutation is implied. */
export class QolipStorageReadState {
  private value: Snapshot;
  private readonly lifetime: QolipLocationChoiceLifetime;
  private stop: (() => void) | null = null;
  private generation = 0;
  private activation = 0;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private viewport: { after: number; ready: boolean } | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(readonly isArchive: boolean, boundary: QolipHomeReadBoundary, private readonly dependencies: Dependencies) {
    this.lifetime = new QolipLocationChoiceLifetime(boundary);
    this.value = { ...empty, invalid: false };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): Snapshot => this.lifetime.getSnapshot() ? this.value : empty;
  canAct = () => this.lifetime.canChoose();
  private notify() { for (const listener of [...this.listeners]) {
    try { const result: unknown = listener(); if (result && typeof (result as PromiseLike<unknown>).then === 'function') void Promise.resolve(result).catch(() => {}); }
    catch { /* All subscribers must see an expired original boundary. */ }
  } }
  private publish(patch: Partial<Snapshot>) {
    if (!this.canAct()) return;
    const next = { ...this.value, ...patch };
    next.visibleArchive = next.archive.filter(entry => next.kind === 'all' || entry.kind === next.kind || (next.kind === 'qolip' && entry.kind === 'paddon_mold'));
    this.value = next; this.notify();
  }
  private cancelPending() {
    this.generation++; this.activation++;
    if (this.debounce !== null) clearTimeout(this.debounce);
    this.debounce = null;
  }
  activate() {
    if (this.stop) return;
    this.stop = this.lifetime.subscribe(() => { this.cancelPending(); this.value = empty; this.notify(); });
    this.lifetime.activate();
  }
  suspend() {
    this.cancelPending(); this.stop?.(); this.stop = null; this.lifetime.suspend();
    this.value = { ...this.value, loading: false, loadingMore: false, warehouseLoading: false, searchPending: false };
  }
  setSaving(saving: boolean) { this.publish({ saving }); }
  setQuery(query: string) {
    if (!this.canAct()) return;
    if (this.debounce !== null) clearTimeout(this.debounce);
    if (this.isArchive) {
      this.generation++;
      this.publish({ query, searchPending: true, loading: false, error: null, moreFailure: false });
    } else this.publish({ query });
    if (!this.canAct()) return;
    this.debounce = setTimeout(() => { this.debounce = null; void this.load(); }, 300);
  }
  async load(more = false): Promise<void> {
    if (!this.canAct() || (more && (this.value.loading || this.value.next === null))) return;
    const offset = more ? this.value.next! : 0, generation = ++this.generation;
    const guard = () => generation === this.generation && this.canAct();
    const input = { status: this.value.history ? 'all' : 'open', view: this.value.kind === 'qolip' ? 'molds' : '',
      warehouse: this.value.warehouse, from: this.value.dates?.from, to: this.value.dates?.to,
      query: trimDart(this.value.query), offset };
    this.publish({ loading: true, loadingMore: this.isArchive && more, error: null, moreFailure: false, searchPending: false });
    try {
      if (!guard()) return;
      if (this.isArchive) {
        const page = await this.dependencies.archive(input, guard);
        if (!guard()) return;
        if (page.next_offset !== null && (page.next_offset <= offset || !page.items.length)) {
          throw new MobileApiException({ code: 'qolip_storage_invalid_page', message: 'Invalid archive page' });
        }
        this.publish({ archive: more ? [...this.value.archive, ...page.items] : [...page.items], next: page.next_offset });
      } else {
        const page = await this.dependencies.paddons({ query: input.query, offset }, guard);
        if (!guard()) return;
        this.publish({ paddons: more ? [...this.value.paddons, ...page.items] : [...page.items], next: page.next_offset });
      }
    } catch (error) { if (guard()) this.publish({ error, moreFailure: this.isArchive && more }); }
    finally {
      if (guard()) { this.publish({ loading: false }); if (this.isArchive && this.value.error === null) this.scheduleMore(); }
    }
  }
  viewportChanged(after: number, ready = true) { if (!this.canAct()) return; this.viewport = { after, ready }; this.scheduleMore(); }
  private scheduleMore() {
    const activation = this.activation;
    this.dependencies.scheduleFrame(() => {
      if (activation !== this.activation || !this.canAct() || !this.isArchive || this.value.loading || this.value.searchPending ||
        this.value.error !== null || this.value.next === null || !this.viewport?.ready) return;
      if (!this.value.visibleArchive.length || this.viewport.after < 240) void this.load(true);
    });
  }
  chooseKind(kind: QolipArchiveKind): Promise<void> {
    if (!this.canAct() || !['all', 'paddon', 'qolip'].includes(kind)) return Promise.resolve();
    this.publish({ kind, kindExpanded: false, archive: [] }); return this.load();
  }
  chooseWarehouse(warehouse: string): Promise<void> {
    if (!this.canAct()) return Promise.resolve();
    this.publish({ warehouse, warehouseExpanded: false }); return this.load();
  }
  chooseDates(dates: QolipStorageDateRange | null): Promise<void> {
    if (!this.canAct() || dates === null) return Promise.resolve();
    this.publish({ dates: { from: new Date(dates.from.getTime()), to: new Date(dates.to.getTime()) } }); return this.load();
  }
  clearFilters(): Promise<void> {
    if (!this.canAct()) return Promise.resolve();
    this.publish({ warehouse: '', dates: null, kind: 'all', warehouseExpanded: false, kindExpanded: false }); return this.load();
  }
  setHistory(history: boolean): Promise<void> {
    if (!this.canAct() || this.value.saving) return Promise.resolve();
    this.publish({ history }); return this.load();
  }
  toggleKindFilter() { this.publish({ kindExpanded: !this.value.kindExpanded, warehouseExpanded: false }); }
  async toggleWarehouseFilter(): Promise<unknown | null> {
    if (!this.canAct()) return null;
    if (this.value.warehouseExpanded) { this.publish({ warehouseExpanded: false }); return null; }
    this.publish({ warehouseExpanded: true, kindExpanded: false });
    if (this.value.warehouseLoading || !this.canAct()) return null;
    const activation = this.activation, guard = () => activation === this.activation && this.canAct();
    this.publish({ warehouseLoading: true });
    try { if (!guard()) return null; const warehouses = await this.dependencies.warehouses(guard); if (guard()) this.publish({ warehouses: [...warehouses] }); }
    catch (error) { if (guard()) return error; }
    finally { if (guard()) this.publish({ warehouseLoading: false }); }
    return null;
  }
}
