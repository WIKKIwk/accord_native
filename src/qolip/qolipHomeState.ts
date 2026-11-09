import type { QolipBlock, QolipBlocksResult } from './qolipBlocksApi';
import { trimDart } from './qolipApiCommon';
import { qolipApplySavedBlockOrder, qolipHomeSearchCounts } from './qolipHomeLogic';
import type { QolipLocationEntry } from './qolipLocationsApi';

type Dependencies = {
  blocks: () => Promise<QolipBlocksResult>;
  locations: (blockName: string) => Promise<QolipLocationEntry[]>;
  readOrder: () => Promise<string[]>;
  valid: () => boolean;
};
type HomeState = { snapshot: QolipBlocksResult | null; orderedBlocks: QolipBlock[]; selectedIndex: number;
  loading: boolean; error: boolean; invalid: boolean; query: string; blockCounts: Record<string, number>;
  cellCounts: Record<string, Record<string, number>> };
function notifySafely(listener: () => unknown) {
  try { const value = listener(); if (value && (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function') void Promise.resolve(value).catch(() => {}); } catch {}
}

/** Initial Home data, search and tab selection only. No mutation, retry or refresh exists. */
export class QolipHomeState {
  private value: HomeState = { snapshot: null, orderedBlocks: [], selectedIndex: 0, loading: true, error: false,
    invalid: false, query: '', blockCounts: {}, cellCounts: {} };
  private active = true;
  private started = false;
  private searchGeneration = 0;
  private searchQuery = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ordered: QolipBlock[] = [];
  private readonly locationReads = new Map<string, Promise<readonly QolipLocationEntry[]>>();
  private readonly resolvedLocations = new Map<string, readonly QolipLocationEntry[]>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private current() { return this.active && this.deps.valid(); }
  private publish(patch: Partial<HomeState> = {}) {
    if (!this.current()) return;
    this.value = { ...this.value, orderedBlocks: [...this.ordered], ...patch };
    for (const listener of [...this.listeners]) notifySafely(listener);
  }
  async start(): Promise<void> {
    if (!this.current() || this.started) return;
    this.started = true;
    try {
      const data = await this.deps.blocks(); if (!this.current()) return;
      const order = await this.deps.readOrder(); if (!this.current()) return;
      const blocks = data.blocks.filter(block => !!trimDart(block.name));
      this.ordered = qolipApplySavedBlockOrder(blocks, order);
      const snapshot = { warehouses: data.warehouses.filter(warehouse => !!trimDart(warehouse)), blocks: this.ordered,
        supports_cross_block_move: data.supports_cross_block_move };
      this.publish({ snapshot, selectedIndex: 0, loading: false, error: false });
      if (this.searchQuery) this.refreshSearch();
    } catch (error) {
      if (this.current()) this.publish({ snapshot: null, loading: false, error: true });
      throw error;
    }
  }
  select(index: number) {
    if (this.current() && index >= 0 && index < this.ordered.length) this.publish({ selectedIndex: index });
  }
  locationsFor(blockName: string): Promise<readonly QolipLocationEntry[]> {
    if (!this.current()) return Promise.reject(new Error('qolip_read_expired'));
    const key = trimDart(blockName).toLowerCase(), existing = this.locationReads.get(key);
    if (existing) return existing;
    const pending = this.deps.locations(blockName).then(rows => {
      if (!this.current()) throw new Error('qolip_read_expired');
      const result = [...rows]; if (!this.current()) throw new Error('qolip_read_expired');
      this.resolvedLocations.set(key, result); return result;
    });
    this.locationReads.set(key, pending); return pending;
  }
  resolvedFor(blockName: string): readonly QolipLocationEntry[] | null {
    return this.current() ? this.resolvedLocations.get(trimDart(blockName).toLowerCase()) ?? null : null;
  }
  setQuery(raw: string) {
    if (!this.current()) return;
    if (this.timer !== null) clearTimeout(this.timer);
    const generation = ++this.searchGeneration, query = trimDart(raw); this.searchQuery = query;
    if (!query) { this.timer = null; this.publish({ query, blockCounts: {}, cellCounts: {} }); return; }
    this.timer = setTimeout(() => { this.timer = null; void this.search(query, generation).catch(() => {}); }, 160);
  }
  private refreshSearch() {
    if (!this.current() || !this.searchQuery) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; void this.search(this.searchQuery, ++this.searchGeneration).catch(() => {});
  }
  private async search(query: string, generation: number) {
    const current = () => this.current() && generation === this.searchGeneration;
    const counts = await qolipHomeSearchCounts([...this.ordered], query, name => this.locationsFor(name), current);
    if (counts && current()) this.publish({ query, blockCounts: counts.blocks, cellCounts: counts.cells });
  }
  invalidateSession() {
    if (!this.active) return;
    this.searchGeneration++; if (this.timer !== null) clearTimeout(this.timer); this.timer = null;
    this.ordered = []; this.locationReads.clear(); this.resolvedLocations.clear(); this.searchQuery = '';
    this.value = { snapshot: null, orderedBlocks: [], selectedIndex: 0, loading: false, error: false, invalid: true,
      query: '', blockCounts: {}, cellCounts: {} };
    for (const listener of [...this.listeners]) notifySafely(listener);
  }
  dispose() { this.active = false; this.searchGeneration++; if (this.timer !== null) clearTimeout(this.timer); this.timer = null;
    this.locationReads.clear(); this.resolvedLocations.clear(); this.listeners.clear(); }
}
