import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';
import { MobileApiException } from '../shared/mobileApiException';
import { trimDart } from './qolipApiCommon';
import { groupQolipStorageProducts, qolipStorageErrorKey, qolipStorageMoldBelongsToProduct, qolipStorageMoldStatus, type QolipStorageProductGroup } from './qolipStoragePresentation';
import { qolipPaddonCodeFromQr, type QolipStorageMold, type QolipStoragePage } from './qolipStorageApi';

type Deps = { current(): boolean; read(input: { query?: string; code?: string; offset?: number }, guard: () => boolean): Promise<QolipStoragePage<QolipStorageMold>>;
  notice(key: string, code?: string, detail?: string): void; confirmDiscard(count: number): Promise<boolean> };
const keyOf = (mold: QolipStorageMold) => trimDart(mold.code).toLowerCase();

/** @v2 _MoldPickerState
 * Source list/product/scanner ownership, selection and exact lookup are kept together.
 */
export class QolipStoragePickerState {
  query = ''; molds: QolipStorageMold[] = []; next: number | null = null;
  loading = false; searchPending = false; error: unknown = null; moreFailure = false;
  scanMode: boolean; loadingProduct: string | null = null; pendingScans = 0; reviewing = false;
  selected = new Map<string, QolipStorageMold>(); scanned = new Set<string>();
  expanded = new Set<string>(); products = new Map<string, QolipStorageMold[]>(); productErrors = new Map<string, unknown>();
  private generation = 0; private scanGeneration = 0; private leaving = false;
  private queue = Promise.resolve(); private queued = new Set<string>(); private debounce: ReturnType<typeof setTimeout> | undefined;
  private revision = 0; private decision: Promise<boolean> | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(readonly warehouse: string | undefined, readonly paddonCode: string | undefined, scan: boolean, private readonly deps: Deps) { this.scanMode = scan; }
  get inline() { return this.paddonCode !== undefined; }
  get listVisible() { return this.inline || !this.scanMode; }
  get busy() { return this.loadingProduct !== null || this.pendingScans > 0; }
  get listPending() { return this.loading || this.searchPending || this.error !== null; }
  get canFinish() { return this.current() && !this.busy && !this.loading && !this.searchPending && this.selected.size > 0; }
  current = () => !this.leaving && this.deps.current();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.revision;
  private notify() { this.revision++; for (const fn of this.listeners) fn(); }
  setReviewing(value: boolean) { if (this.current()) { this.reviewing = value; this.notify(); } }
  eligible(mold: QolipStorageMold) { return mold.available && (this.warehouse === undefined || mold.warehouse.toLowerCase() === this.warehouse.toLowerCase()); }
  groups(): readonly QolipStorageProductGroup[] {
    return groupQolipStorageProducts(this.molds.filter(mold => this.eligible(mold)), this.query)
      .filter(group => this.products.get(group.key)?.some(mold => this.eligible(mold)) ?? true);
  }
  private remember(molds: readonly QolipStorageMold[], replace = false) {
    const latest = new Map(molds.map(mold => [keyOf(mold), mold]));
    this.molds = [...new Map([...(replace ? [] : this.molds.map(mold => [keyOf(mold), mold] as const)), ...latest]).values()];
    for (const [key, existing] of this.products) this.products.set(key, [...new Map([...existing.map(mold => [keyOf(mold), mold] as const), ...latest]).values()]
      .filter(mold => qolipStorageMoldBelongsToProduct(mold, key)));
  }
  private rememberConcurrent(snapshot: ReadonlyMap<string, QolipStorageMold> | null, loaded: readonly QolipStorageMold[]) {
    if (!snapshot || !this.scanned.size) return;
    const loadedKeys = new Set(loaded.map(keyOf));
    this.remember([...this.selected].filter(([key, mold]) => this.scanned.has(key) && (!loadedKeys.has(key) || mold !== snapshot.get(key))).map(([, mold]) => mold));
  }
  async load(more = false) {
    if (!this.current() || (more && (this.loading || this.searchPending || this.busy || this.reviewing || !this.listVisible || this.next === null))) return;
    const offset = more ? this.next! : 0, generation = ++this.generation;
    const selectedAtStart = this.inline ? new Map(this.selected) : null;
    this.loading = true; this.error = null; this.moreFailure = false; this.searchPending = false;
    if (!more) { this.expanded.clear(); this.products.clear(); this.productErrors.clear(); }
    this.notify();
    const guard = () => this.current() && generation === this.generation;
    try {
      const page = await this.deps.read({ query: trimDart(this.query), offset }, guard);
      if ((more && !await this.afterDecision()) || !guard()) return;
      if (page.next_offset !== null && (page.next_offset <= offset || !page.items.length)) throw new MobileApiException({ code: 'qolip_storage_invalid_page', message: 'Invalid mold page' });
      this.remember(page.items, !more); this.next = page.next_offset;
      for (const mold of page.items) {
        const key = keyOf(mold);
        if (this.selected.has(key) && (selectedAtStart === null || this.selected.get(key) === selectedAtStart.get(key))) {
          if (this.eligible(mold)) this.selected.set(key, mold); else { this.selected.delete(key); this.scanned.delete(key); }
        }
      }
      this.rememberConcurrent(selectedAtStart, page.items);
    } catch (error) { if (guard()) { this.error = error; this.moreFailure = more; } }
    finally { if (guard()) { this.loading = false; this.notify(); } }
  }
  setQuery(query: string) {
    if (!this.current() || !this.listVisible || this.busy) return;
    clearTimeout(this.debounce); this.query = query; this.searchPending = true; this.generation++; this.loading = false; this.notify();
    this.debounce = setTimeout(() => { void this.load(); }, 300);
  }
  toggle(mold: QolipStorageMold, select = !this.selected.has(keyOf(mold))) {
    if (!this.current() || this.loadingProduct !== null || (!this.inline && !this.scanMode && this.listPending) || !this.eligible(mold)) return;
    const key = keyOf(mold);
    if (select && !this.selected.has(key) && this.selected.size >= 1000) { this.deps.notice('capacity_error'); return; }
    if (select) this.selected.set(key, mold); else { this.selected.delete(key); this.scanned.delete(key); }
    this.notify();
  }
  productSelection(group: QolipStorageProductGroup): boolean | null {
    if (![...this.selected.values()].some(mold => qolipStorageMoldBelongsToProduct(mold, group.key))) return false;
    const complete = this.products.get(group.key);
    if (!complete) return null;
    const eligible = new Set(complete.filter(mold => this.eligible(mold)).map(keyOf));
    return eligible.size > 0 && [...eligible].every(key => this.selected.has(key)) ? true : null;
  }
  async loadProduct(group: QolipStorageProductGroup) {
    if (!this.current() || this.busy || this.listPending) return null;
    const generation = this.generation, snapshot = this.inline ? new Map(this.selected) : null;
    this.loadingProduct = group.key; this.productErrors.delete(group.key); this.notify();
    const guard = () => this.current() && generation === this.generation;
    try {
      const found = new Map<string, QolipStorageMold>(); let offset = 0;
      while (true) {
        const page = await this.deps.read({ query: group.code, offset }, guard);
        if (!await this.afterDecision() || !guard()) return null;
        for (const mold of page.items) if (qolipStorageMoldBelongsToProduct(mold, group.key)) found.set(keyOf(mold), mold);
        if (page.next_offset === null) break;
        if (page.next_offset <= offset || page.next_offset >= 10000) throw new MobileApiException({ code: 'qolip_product_load_limit', message: 'Incomplete product' });
        offset = page.next_offset;
      }
      const molds = [...found.values()].sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);
      this.products.set(group.key, molds); this.remember(molds); let removed = false;
      for (const mold of molds) {
        const key = keyOf(mold);
        if (this.selected.has(key) && (snapshot === null || this.selected.get(key) === snapshot.get(key))) {
          if (this.eligible(mold)) this.selected.set(key, mold); else { this.selected.delete(key); this.scanned.delete(key); removed = true; }
        }
      }
      this.rememberConcurrent(snapshot, molds); if (removed) this.deps.notice('changed');
      return this.inline ? this.products.get(group.key)! : molds;
    } catch (error) {
      if (await this.afterDecision() && guard()) {
        this.productErrors.set(group.key, error);
        if (!this.expanded.has(group.key)) this.deps.notice(error instanceof MobileApiException && error.code === 'qolip_product_load_limit' ? 'product_load_limit' : 'failed');
      }
      return null;
    }
    finally { if (this.loadingProduct === group.key) { this.loadingProduct = null; this.notify(); } }
  }
  async expand(group: QolipStorageProductGroup) {
    if (!this.current() || this.busy || this.listPending) return;
    if (this.expanded.delete(group.key)) { this.notify(); return; }
    this.expanded.add(group.key); this.notify();
    if (!this.products.has(group.key) || this.productErrors.has(group.key)) await this.loadProduct(group);
  }
  async toggleProduct(group: QolipStorageProductGroup) {
    if (!this.current() || this.busy || this.listPending) return;
    const deselect = this.productSelection(group) === true;
    const molds = this.productErrors.has(group.key) ? await this.loadProduct(group) : this.products.get(group.key) ?? await this.loadProduct(group);
    if (!await this.afterDecision() || !this.current() || molds === null) return;
    const eligible = molds.filter(mold => this.eligible(mold));
    if (!deselect && !eligible.length) { this.deps.notice('changed'); return; }
    if (!deselect && new Set([...this.selected.keys(), ...eligible.map(keyOf)]).size > 1000) { this.deps.notice('capacity_error'); return; }
    if (deselect) for (const [key, mold] of this.selected) { if (qolipStorageMoldBelongsToProduct(mold, group.key)) { this.selected.delete(key); this.scanned.delete(key); } }
    else for (const mold of eligible) this.selected.set(keyOf(mold), mold);
    this.notify();
  }
  changeMode(scan: boolean) {
    if (!this.current() || this.reviewing || this.loadingProduct !== null || scan === this.scanMode) return;
    this.invalidateScans(); this.scanMode = scan;
    if (!this.inline) { this.generation++; this.loading = false; this.searchPending = false; clearTimeout(this.debounce); }
    this.notify(); if (!scan && !this.inline) void this.load();
  }
  private invalidateScans() { this.scanGeneration++; this.queue = Promise.resolve(); this.queued.clear(); this.pendingScans = 0; }
  async scan(raw: string) {
    const scan = this.scanGeneration, current = () => this.current() && this.scanMode && !this.reviewing && scan === this.scanGeneration;
    if (!current()) return;
    let code: string;
    try { code = trimDart(rawMaterialBarcodeFromQr(raw)); } catch { this.deps.notice('not_found'); return; }
    const key = code.toLowerCase();
    if (!code || this.queued.has(key)) return;
    if (qolipPaddonCodeFromQr(code) !== null) { this.deps.notice('invalid_mold_qr'); return; }
    if (this.selected.has(key)) { if (this.inline) { this.scanned.delete(key); this.scanned.add(key); this.notify(); } this.deps.notice('duplicate', code); return; }
    if (this.selected.size + this.pendingScans >= 1000) { this.deps.notice('capacity_error'); return; }
    this.queued.add(key); this.pendingScans++; this.notify();
    const operation = this.queue.then(async () => {
      try {
        if (!await this.afterDecision() || !current()) return;
        const page = await this.deps.read({ code }, current);
        if (!await this.afterDecision() || !current()) return;
        const mold = page.items.length === 1 ? page.items[0] : null;
        if (!mold || keyOf(mold) !== key || page.next_offset !== null) { this.deps.notice('not_found', code); return; }
        if (!this.eligible(mold)) { const status = qolipStorageMoldStatus(mold, this.warehouse); this.deps.notice(status.key, mold.code, status.code); return; }
        if (this.selected.has(key)) { this.deps.notice('duplicate', mold.code); return; }
        if (this.inline) { this.remember([mold]); this.scanned.delete(key); this.scanned.add(key); }
        this.selected.set(key, mold); this.deps.notice('scan_accepted', mold.code); this.notify();
      } catch (error) { if (await this.afterDecision() && current()) this.deps.notice(qolipStorageErrorKey(error)); }
      finally { if (scan === this.scanGeneration) { this.queued.delete(key); this.pendingScans--; this.notify(); } }
    });
    this.queue = operation; await operation;
  }
  private afterDecision() { return this.decision ?? Promise.resolve(true); }
  async leave(): Promise<boolean> {
    if (!this.current() || this.reviewing) return false;
    if (this.selected.size || this.busy) {
      this.reviewing = true; this.notify();
      let resume!: (value: boolean) => void;
      this.decision = new Promise(resolve => { resume = resolve; });
      const confirmed = await this.deps.confirmDiscard(this.selected.size);
      this.decision = null; this.reviewing = false; resume(this.current() && !confirmed); this.notify();
      if (!confirmed || !this.current()) return false;
    }
    this.dispose(); return true;
  }
  finish(): readonly QolipStorageMold[] | null { if (!this.canFinish) return null; const result = [...this.selected.values()]; this.dispose(); return result; }
  dispose() { this.leaving = true; this.generation++; clearTimeout(this.debounce); this.invalidateScans(); this.notify(); }
}
