import type { qolipCatalogPage, qolipProductFromJson } from '../qolipCatalogApi';

type Page = Awaited<ReturnType<typeof qolipCatalogPage>>;
type Item = Page['items'][number];
type Product = ReturnType<typeof qolipProductFromJson>;
type Options = {
  scope: () => string;
  requestScope: () => string;
  page: (query: string, cursor: string | null) => Promise<Page>;
  details: (id: string) => Promise<Product[]>;
  parseProduct: (value: unknown) => Product;
};

/** @v2 QolipCatalogWindow */
export class QolipCatalogWindow {
  items: readonly Item[] = [];
  nextCursor: string | null = null;
  loaded = false;
  scrollOffset = 0;
}

/** @v2 QolipCatalogStore */
export class QolipCatalogStore {
  private scope: string | null = null;
  private generation = 0;
  private writeVersion = 0;
  private detailsGeneration = 0;
  private readonly windows = new Map<string, QolipCatalogWindow>();
  private readonly requests = new Map<string, Promise<QolipCatalogWindow>>();
  private readonly detailValues = new Map<string, readonly Product[]>();
  private readonly searchTerms = new Map<string, string[]>();
  private readonly detailReads = new Map<string, Promise<readonly Product[]>>();
  private readonly overrides = new Map<string, Item | null>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly options: Options) {}
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
  private synchronize(): void {
    const current = this.options.scope();
    if (this.scope === current) return;
    this.reset(); this.scope = current;
  }
  reset(): void {
    this.generation++; this.writeVersion++; this.scope = null;
    this.windows.clear(); this.requests.clear(); this.detailValues.clear(); this.searchTerms.clear();
    this.detailReads.clear(); this.overrides.clear();
  }
  window(query: string): QolipCatalogWindow {
    this.synchronize();
    const key = query.trim().toLowerCase(); let window = this.windows.get(key);
    if (!window) { window = new QolipCatalogWindow(); this.windows.set(key, window); }
    return window;
  }
  details(id: string): readonly Product[] | null { this.synchronize(); return this.detailValues.get(id) ?? null; }
  invalidateDetails(): void { this.detailsGeneration++; this.detailValues.clear(); this.detailReads.clear(); this.notify(); }
  async prepare(): Promise<void> { try { await this.first(); } catch { /* Optional warmup can be retried. */ } }
  first(query = '', force = false): Promise<QolipCatalogWindow> {
    const target = this.window(query);
    if (force) { this.reset(); this.scope = this.options.scope(); return this.first(query); }
    return target.loaded ? Promise.resolve(target) : this.read(query, null, target);
  }
  more(query: string): Promise<QolipCatalogWindow> {
    const target = this.window(query);
    if (!target.loaded) return this.first(query);
    return target.nextCursor === null ? Promise.resolve(target) : this.read(query, target.nextCursor, target);
  }
  private read(query: string, cursor: string | null, target: QolipCatalogWindow): Promise<QolipCatalogWindow> {
    const key = JSON.stringify([query.trim().toLowerCase(), cursor]), existing = this.requests.get(key);
    if (existing) return existing;
    const generation = this.generation, scope = this.scope;
    let pending!: Promise<QolipCatalogWindow>;
    pending = (async () => {
      try {
        const page = await this.options.page(query, cursor);
        if (generation !== this.generation || scope !== this.options.scope()) throw new Error('Qolip catalog session changed');
        const rows = new Map<string, Item>(cursor === null ? [] : target.items.map(item => [item.id, item]));
        for (const item of page.items) rows.set(item.id, item);
        this.applyOverrides(rows, query); target.items = this.sorted(rows.values());
        target.nextCursor = page.next_cursor; target.loaded = true; return target;
      } finally { if (this.requests.get(key) === pending) this.requests.delete(key); }
    })();
    this.requests.set(key, pending); return pending;
  }
  loadDetails(id: string): Promise<readonly Product[]> {
    this.synchronize();
    const cached = this.detailValues.get(id); if (cached) return Promise.resolve(cached);
    const existing = this.detailReads.get(id); if (existing) return existing;
    const generation = this.generation, version = this.writeVersion, detailGeneration = this.detailsGeneration, scope = this.scope;
    let pending!: Promise<readonly Product[]>;
    pending = (async () => {
      try {
        const products = await this.options.details(id);
        if (generation !== this.generation || scope !== this.options.scope()) throw new Error('Qolip catalog session changed');
        if (detailGeneration !== this.detailsGeneration) throw new Error('Qolip availability changed');
        if (version !== this.writeVersion && this.overrides.has(id)) {
          const current = this.detailValues.get(id);
          if (!current) throw new Error('Qolip product removed');
          return current;
        }
        this.detailValues.set(id, products); this.searchTerms.set(id, this.terms(products)); return products;
      } finally { if (this.detailReads.get(id) === pending) this.detailReads.delete(id); }
    })();
    this.detailReads.set(id, pending); return pending;
  }
  applyResponse(response: Record<string, unknown>, requestScope: string): void {
    if (requestScope !== this.options.requestScope()) return;
    this.synchronize();
    const delta = response.catalog_delta;
    if (!delta || typeof delta !== 'object' || Array.isArray(delta) || (delta as Record<string, unknown>).reset === true) {
      this.reset(); this.notify(); return;
    }
    try {
      const source = delta as Record<string, unknown>;
      if (!Array.isArray(source.upserts) || !Array.isArray(source.removed_ids) || source.removed_ids.some(id => typeof id !== 'string')) throw new TypeError('Invalid catalog delta');
      const upserts = source.upserts.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid catalog row');
        const row = value as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.name !== 'string' ||
            (row.order_image_order_id != null && typeof row.order_image_order_id !== 'string') || !Array.isArray(row.products) || !row.products.length) {
          throw new TypeError('Invalid catalog row');
        }
        const item: Item = { id: row.id, name: row.name, order_image_order_id: (row.order_image_order_id as string | undefined) ?? '' };
        return { item, products: row.products.map(this.options.parseProduct) };
      });
      this.writeVersion++;
      for (const id of source.removed_ids as string[]) { this.overrides.set(id, null); this.detailValues.delete(id); this.searchTerms.delete(id); }
      for (const { item, products } of upserts) {
        this.overrides.set(item.id, item); this.detailValues.set(item.id, Object.freeze(products)); this.searchTerms.set(item.id, this.terms(products));
      }
      for (const [query, window] of this.windows) {
        const rows = new Map(window.items.map(item => [item.id, item]));
        this.applyOverrides(rows, query); window.items = this.sorted(rows.values());
      }
      this.notify();
    } catch { this.reset(); this.notify(); }
  }
  private terms(products: readonly Product[]): string[] { return products.flatMap(item => [item.code, item.qolip_code, ...item.customer_names]); }
  private applyOverrides(rows: Map<string, Item>, query: string): void {
    const q = query.trim().toLowerCase();
    for (const [id, item] of this.overrides) {
      const matches = item && (!q || item.name.toLowerCase().includes(q) || (this.searchTerms.get(id) ?? []).some(value => value.toLowerCase().includes(q)));
      if (matches && item) rows.set(id, item); else rows.delete(id);
    }
  }
  private sorted(items: Iterable<Item>): readonly Item[] {
    return Object.freeze([...items].sort((a, b) => {
      const first = a.name.toLowerCase(), second = b.name.toLowerCase();
      return first === second ? (a.id === b.id ? 0 : a.id < b.id ? -1 : 1) : first < second ? -1 : 1;
    }));
  }
}

/** @v2 qolipCatalogId */
export function qolipCatalogId(code: string): string {
  const bytes = new TextEncoder().encode(code.trim().toLowerCase()), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    encoded += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) encoded += alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) encoded += alphabet[c & 63];
  }
  return `qp1.${encoded}`;
}
