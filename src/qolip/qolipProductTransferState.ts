import type { qolipProductFromJson } from '../qolipCatalogApi';
export type QolipTransferProduct = ReturnType<typeof qolipProductFromJson>;
export type QolipProductTransferSnapshot = {
  molds: readonly QolipTransferProduct[]; source: QolipTransferProduct | null; target: QolipTransferProduct | null;
  selectedProduct: QolipTransferProduct | null; selected: ReadonlySet<string>; loading: boolean; saving: boolean; scanning: boolean; error: unknown;
};
type Dependencies = {
  current(): boolean;
  products(input: { query?: string; limit: number; with_qolip_only: boolean }): Promise<QolipTransferProduct[]>;
  transfer(input: { requestId: string; fromItemCode: string; toItemCode: string; qolipCodes: string[] }): Promise<QolipTransferProduct[]>;
  requestId(): Promise<string>;
  confirm(from: QolipTransferProduct, to: QolipTransferProduct, codes: string[], displayed: string[]): Promise<boolean>;
  scan(): Promise<string | null>;
  lookup(code: string): Promise<{ kind: string; product: QolipTransferProduct | null }>;
  pickCandidate(items: QolipTransferProduct[]): Promise<QolipTransferProduct | null>;
  notice(key: string, values?: Record<string, unknown>): void;
  error(error: unknown, fallback: string): void;
  changed(): void;
  scrollTo(product: QolipTransferProduct): void;
};
const normalized = (value: string) => value.trim().toLowerCase();

/** V2 QolipProductTransferScreen: selection, scan candidates, confirmation, retained retry ID and atomic pane publication. */
export class QolipProductTransferState {
  private value: QolipProductTransferSnapshot = { molds: [], source: null, target: null, selectedProduct: null,
    selected: new Set(), loading: true, saving: false, scanning: false, error: null };
  private active = false;
  private generation = 0;
  private requestSignature: string | null = null;
  private requestId: string | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  current = () => this.active && this.deps.current();
  private publish(patch: Partial<QolipProductTransferSnapshot>) {
    if (!this.current()) return;
    this.value = { ...this.value, ...patch }; for (const listener of this.listeners) listener();
  }
  activate() { this.active = true; }
  suspend() { this.active = false; this.generation++; }
  forProduct(product: QolipTransferProduct | null) {
    return product ? this.value.molds.filter(item => normalized(item.code) === normalized(product.code)) : [];
  }
  async reload() {
    if (!this.current()) return;
    const generation = ++this.generation; this.publish({ loading: true, error: null });
    try {
      const molds = await this.deps.products({ limit: 20000, with_qolip_only: true });
      if (!this.current() || generation !== this.generation) return;
      const selectedCode = this.value.selectedProduct ? normalized(this.value.selectedProduct.code) : null;
      const available = new Set(molds.filter(item => !item.is_in_use && normalized(item.code) === selectedCode).map(item => normalized(item.qolip_code)));
      this.publish({ molds, selected: new Set([...this.value.selected].filter(code => available.has(code))) });
    } catch (error) { if (generation === this.generation) this.publish({ error }); }
    finally { if (generation === this.generation) this.publish({ loading: false }); }
  }
  /** One source picker keeps the loaded query pages for its own presentation lifetime. */
  productPicker(source: boolean) {
    const pages = new Map<string, Promise<QolipTransferProduct[]>>();
    return async (query: string, offset: number, limit: number) => {
      if (!this.current()) return [];
      let future = pages.get(query);
      if (!future) {
        future = (async () => {
          const products = source && !query.trim() ? this.value.molds
            : await this.deps.products({ query, limit: 20000, with_qolip_only: source });
          if (!this.current()) return [];
          const opposite = source ? this.value.target : this.value.source, unique = new Map<string, QolipTransferProduct>();
          for (const product of products) {
            const code = normalized(product.code);
            if (code && code !== (opposite ? normalized(opposite.code) : undefined) && !unique.has(code)) unique.set(code, product);
          }
          return [...unique.values()];
        })(); pages.set(query, future);
      }
      const items = await future;
      return this.current() ? items.slice(offset, offset + limit) : [];
    };
  }
  selectProduct(source: boolean, product: QolipTransferProduct) {
    if (!this.current() || this.value.saving || this.value.scanning) return;
    const previous = source ? this.value.source : this.value.target;
    const clear = this.value.selectedProduct?.code === previous?.code;
    this.publish({ [source ? 'source' : 'target']: product, ...(clear ? { selected: new Set(), selectedProduct: null } : {}) });
  }
  toggle(code: string, product: QolipTransferProduct) {
    if (!this.current() || this.value.saving || this.value.scanning) return;
    const selected = new Set(this.value.selectedProduct?.code === product.code ? this.value.selected : []);
    if (!selected.has(code) && selected.size >= 100) { this.deps.notice('limit'); return; }
    if (selected.has(code)) selected.delete(code); else selected.add(code);
    this.publish({ selectedProduct: product, selected });
  }
  dragItems(item: QolipTransferProduct, product: QolipTransferProduct): QolipTransferProduct[] {
    if (!this.current() || item.is_in_use || this.value.saving || this.value.scanning) return [];
    return this.value.selected.has(normalized(item.qolip_code)) ? this.forProduct(product).filter(mold => this.value.selected.has(normalized(mold.qolip_code)) && !mold.is_in_use) : [item];
  }
  async scanSource() {
    if (!this.current() || this.value.saving || this.value.scanning) return;
    this.publish({ scanning: true });
    try {
      const code = await this.deps.scan(); if (!code || !this.current()) return;
      const scanned = await this.deps.lookup(code); if (!this.current()) return;
      if (!scanned.product) throw new Error('scan_failed');
      await this.reload(); if (!this.current()) return;
      const matches = this.value.molds.filter(item => normalized(item.qolip_code) === normalized(scanned.product!.qolip_code));
      if (!matches.length) throw new Error('scan_failed');
      const candidates = new Map(matches.map(item => [normalized(item.code), item]));
      const previous = this.value.source ? candidates.get(normalized(this.value.source.code)) : null;
      const mold = previous ?? (candidates.size === 1 ? [...candidates.values()][0] : await this.deps.pickCandidate([...candidates.values()]));
      if (!mold || !this.current()) return;
      this.publish({ source: mold, selectedProduct: mold, target: this.value.target?.code === mold.code ? null : this.value.target,
        selected: new Set(mold.is_in_use ? [] : [normalized(mold.qolip_code)]) });
      if (mold.is_in_use) this.deps.notice('in_use');
    } catch (error) { if (this.current()) this.deps.error(error, 'scan_failed'); }
    finally { this.publish({ scanning: false }); }
  }
  async move(codes: readonly string[], from: QolipTransferProduct, to: QolipTransferProduct) {
    if (!this.current() || this.value.saving || !codes.length || from.code === to.code) return;
    const source = this.forProduct(from), known = new Set(source.map(item => normalized(item.qolip_code)));
    if (codes.some(code => !known.has(code))) { this.deps.notice('unknown'); return; }
    const sorted = [...new Set(codes)].sort(), available = new Set(source.filter(item => !item.is_in_use).map(item => normalized(item.qolip_code)));
    if (sorted.length > 100) { this.deps.notice('limit'); return; }
    if (sorted.some(code => !available.has(code))) { this.deps.notice('in_use'); return; }
    this.publish({ saving: true });
    try {
      const display = sorted.map(code => this.value.molds.find(item => normalized(item.qolip_code) === code)!.qolip_code);
      if (!await this.deps.confirm(from, to, sorted, display) || !this.current()) return;
      const signature = JSON.stringify([from.code, to.code, sorted]);
      if (this.requestSignature !== signature || !this.requestId) { this.requestSignature = signature; this.requestId = await this.deps.requestId(); }
      if (!this.current()) return;
      const saved = await this.deps.transfer({ requestId: this.requestId, fromItemCode: from.code, toItemCode: to.code, qolipCodes: sorted });
      if (!this.current()) return;
      const moved = new Set(sorted); this.generation++;
      this.publish({ molds: [...saved, ...this.value.molds.filter(item => !moved.has(normalized(item.qolip_code)) ||
        (normalized(item.code) !== normalized(from.code) && normalized(item.code) !== normalized(to.code)))], selected: new Set(), selectedProduct: null });
      this.requestSignature = null; this.requestId = null; this.deps.scrollTo(to); this.deps.changed(); this.deps.notice('success', { count: sorted.length });
    } catch (error) { if (this.current()) this.deps.error(error, 'failed'); }
    finally { this.publish({ saving: false }); }
  }
}
