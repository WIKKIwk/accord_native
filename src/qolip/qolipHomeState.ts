import type { QolipBlock, QolipBlocksResult } from './qolipBlocksApi';
import { trimDart } from './qolipApiCommon';
import { qolipApplySavedBlockOrder, qolipHomeBlockKey, qolipHomeSearchCounts, qolipReorderBlocks } from './qolipHomeLogic';
import type { QolipLocationEntry } from './qolipLocationsApi';

type Dependencies = {
  blocks: () => Promise<QolipBlocksResult>;
  locations: (blockName: string) => Promise<QolipLocationEntry[]>;
  readOrder: () => Promise<string[]>;
  saveOrder: (keys: string[]) => Promise<void>;
  scope: () => string;
  valid: () => boolean;
};
type HomeState = { snapshot: QolipBlocksResult | null; orderedBlocks: QolipBlock[]; selectedIndex: number;
  loading: boolean; error: boolean; invalid: boolean; query: string; blockCounts: Record<string, number>;
  cellCounts: Record<string, Record<string, number>> };

/** Data and search subset of @v2 _QolipHomeScreenState. Quiet refresh and lifecycle integration remain separate open work. */
export class QolipHomeState {
  private value: HomeState = { snapshot: null, orderedBlocks: [], selectedIndex: 0, loading: true, error: false,
    invalid: false, query: '', blockCounts: {}, cellCounts: {} };
  private active = true;
  private homeScope: string;
  private currentRead = 0;
  private searchGeneration = 0;
  private searchQuery = '';
  private readonly resolvedLocations = new Map<string, readonly QolipLocationEntry[]>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly locationReads = new Map<string, Promise<readonly QolipLocationEntry[]>>();
  private readonly locationGenerations = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private ordered: QolipBlock[] = [];
  constructor(private readonly deps: Dependencies) { this.homeScope = deps.scope(); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.value;
  private publish(patch: Partial<HomeState> = {}) {
    if (!this.active) return;
    this.value = { ...this.value, orderedBlocks: [...this.ordered], ...patch };
    this.listeners.forEach(listener => listener());
  }
  get displayBlocks(): readonly QolipBlock[] {
    return this.value.orderedBlocks.length ? this.value.orderedBlocks : this.value.snapshot?.blocks ?? [];
  }
  activate() { this.active = true; }
  async start(): Promise<void> { await this.readBlocks(); }
  private async readBlocks(): Promise<void> {
    const generation = ++this.currentRead, scope = this.homeScope;
    this.publish({ loading: this.value.snapshot === null, error: false });
    try {
      const data = await this.deps.blocks();
      const blocks = data.blocks.filter(block => !!trimDart(block.name));
      const ordered = qolipApplySavedBlockOrder(blocks, await this.deps.readOrder());
      const snapshot: QolipBlocksResult = { warehouses: data.warehouses.filter(warehouse => !!trimDart(warehouse)),
        blocks: ordered, supports_cross_block_move: data.supports_cross_block_move };
      if (!this.active || scope !== this.homeScope || scope !== this.deps.scope()) return;
      // V2 assigns the internal ordered list even if a newer FutureBuilder read is in flight.
      this.ordered = ordered;
      if (generation === this.currentRead) {
        const selectedIndex = Math.max(0, Math.min(this.value.selectedIndex, ordered.length));
        this.publish({ snapshot, selectedIndex, loading: false, error: false });
      }
      if (this.searchQuery) this.refreshSearch();
    } catch (error) {
      if (this.active && scope === this.homeScope && scope === this.deps.scope() && generation === this.currentRead) {
        this.publish({ snapshot: null, loading: false, error: true });
      }
      throw error;
    }
  }
  async reload(): Promise<void> {
    if (!this.active) return;
    this.searchGeneration++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const [key, generation] of this.locationGenerations) this.locationGenerations.set(key, generation + 1);
    this.locationReads.clear(); this.resolvedLocations.clear(); this.ordered = [];
    this.publish({ blockCounts: {}, cellCounts: {} });
    await this.readBlocks();
  }
  reorder(oldIndex: number, newIndex: number) {
    const result = qolipReorderBlocks(this.ordered, this.value.selectedIndex, oldIndex, newIndex);
    if (!result.changed) return;
    this.ordered = result.blocks;
    const snapshot = this.value.snapshot ? { ...this.value.snapshot, blocks: result.blocks } : null;
    this.publish({ snapshot, selectedIndex: result.selectedIndex });
    void this.deps.saveOrder(result.blocks.map(qolipHomeBlockKey));
  }
  select(index: number) {
    if (index >= 0 && index < this.ordered.length) this.publish({ selectedIndex: index });
  }
  locationsFor(blockName: string): Promise<readonly QolipLocationEntry[]> {
    const key = trimDart(blockName).toLowerCase(), existing = this.locationReads.get(key);
    if (existing) return existing;
    return this.startLocationRead(blockName, key);
  }
  private startLocationRead(blockName: string, key: string): Promise<readonly QolipLocationEntry[]> {
    const generation = (this.locationGenerations.get(key) ?? 0) + 1, scope = this.homeScope;
    this.locationGenerations.set(key, generation);
    const next = this.deps.locations(blockName).then(locations => {
      const result = [...locations];
      if (this.active && scope === this.homeScope && scope === this.deps.scope() && this.locationGenerations.get(key) === generation) {
        this.resolvedLocations.set(key, result);
      }
      return result;
    });
    this.locationReads.set(key, next);
    return next;
  }
  resolvedFor(blockName: string): readonly QolipLocationEntry[] | null {
    return this.resolvedLocations.get(trimDart(blockName).toLowerCase()) ?? null;
  }
  refreshBlock(blockName: string): Promise<readonly QolipLocationEntry[]> {
    const key = trimDart(blockName).toLowerCase(), next = this.startLocationRead(blockName, key);
    this.publish();
    void next.then(() => this.refreshSearch(), () => {});
    return next;
  }
  setQuery(raw: string) {
    if (!this.active) return;
    if (this.timer) clearTimeout(this.timer);
    const generation = ++this.searchGeneration, query = trimDart(raw);
    this.searchQuery = query;
    if (!query) { this.timer = null; this.publish({ query, blockCounts: {}, cellCounts: {} }); return; }
    this.timer = setTimeout(() => { this.timer = null; void this.search(query, generation); }, 160);
  }
  refreshSearch() {
    if (!this.active || !this.searchQuery) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.search(this.searchQuery, ++this.searchGeneration);
  }
  private async search(query: string, generation: number) {
    const current = () => this.active && generation === this.searchGeneration;
    const counts = await qolipHomeSearchCounts([...this.ordered], query, name => this.locationsFor(name), current);
    if (counts && current()) this.publish({ query, blockCounts: counts.blocks, cellCounts: counts.cells });
  }
  handleSessionChange() {
    if (!this.active) return;
    const scope = this.deps.scope(), invalid = !this.deps.valid();
    if (scope === this.homeScope && invalid === this.value.invalid) return;
    this.homeScope = scope; this.currentRead++; this.searchGeneration++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.locationReads.clear(); this.locationGenerations.clear(); this.resolvedLocations.clear();
    this.searchQuery = ''; this.ordered = [];
    this.publish({ invalid, snapshot: null, selectedIndex: 0, query: '', blockCounts: {}, cellCounts: {},
      loading: !invalid, error: false });
    if (!invalid) void this.readBlocks().catch(() => {});
  }
  dispose() {
    this.active = false; this.currentRead++; this.searchGeneration++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.listeners.clear();
  }
}
