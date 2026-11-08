import type { QolipBlock, QolipBlocksResult } from './qolipBlocksApi';
import { trimDart } from './qolipApiCommon';
import { qolipApplySavedBlockOrder, qolipHomeBlockKey, qolipHomeSearchCounts, qolipReorderBlocks,
  sameQolipHomeBlocks, sameQolipHomeLocations } from './qolipHomeLogic';
import type { QolipLocationEntry } from './qolipLocationsApi';

type Dependencies = {
  blocks: () => Promise<QolipBlocksResult>;
  locations: (blockName: string) => Promise<QolipLocationEntry[]>;
  readOrder: () => Promise<string[]>;
  saveOrder: (keys: string[]) => Promise<void>;
  scope: () => string;
  valid: () => boolean;
  afterFrame: (callback: () => void) => void;
};
type HomeState = { snapshot: QolipBlocksResult | null; orderedBlocks: QolipBlock[]; selectedIndex: number;
  loading: boolean; error: boolean; invalid: boolean; query: string; blockCounts: Record<string, number>;
  cellCounts: Record<string, Record<string, number>> };

/** Home read/search/refresh state. The screen actions and native wiring remain open. */
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
  private homeSnapshot: QolipBlocksResult | null = null;
  private homeDataReady = false;
  private quietGeneration = 0;
  private quietInFlight = false;
  private quietQueued = false;
  private quietCooldown: ReturnType<typeof setTimeout> | null = null;
  private routeKnown = false;
  private routeCurrent = false;
  private readonly locationReads = new Map<string, Promise<readonly QolipLocationEntry[]>>();
  private readonly locationGenerations = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private ordered: QolipBlock[] = [];
  constructor(private readonly deps: Dependencies, private readonly preserveHome = true) { this.homeScope = deps.scope(); }
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
  /** @v2 _loadBlocks */
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
      this.ordered = ordered; this.homeSnapshot = snapshot; this.homeDataReady = true;
      if (this.preserveHome) this.startQuietCooldown();
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
  /** @v2 _reloadBlocks */
  async reload(): Promise<void> {
    if (!this.active) return;
    this.quietGeneration++; this.quietQueued = false;
    this.searchGeneration++;
    if (this.timer !== null) clearTimeout(this.timer);
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
    if (this.homeSnapshot) this.homeSnapshot = { ...this.homeSnapshot, blocks: result.blocks };
    this.publish({ snapshot, selectedIndex: result.selectedIndex });
    void this.deps.saveOrder(result.blocks.map(qolipHomeBlockKey));
  }
  select(index: number) {
    if (index >= 0 && index < this.ordered.length) this.publish({ selectedIndex: index });
  }
  /** @v2 _locationsFor */
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
  /** @v2 _onSearchChanged */
  setQuery(raw: string) {
    if (!this.active) return;
    if (this.timer !== null) clearTimeout(this.timer);
    const generation = ++this.searchGeneration, query = trimDart(raw);
    this.searchQuery = query;
    if (!query) { this.timer = null; this.publish({ query, blockCounts: {}, cellCounts: {} }); return; }
    this.timer = setTimeout(() => { this.timer = null; void this.search(query, generation); }, 160);
  }
  refreshSearch() {
    if (!this.active || !this.searchQuery) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    void this.search(this.searchQuery, ++this.searchGeneration);
  }
  private async search(query: string, generation: number) {
    const current = () => this.active && generation === this.searchGeneration;
    const counts = await qolipHomeSearchCounts([...this.ordered], query, name => this.locationsFor(name), current);
    if (counts && current()) this.publish({ query, blockCounts: counts.blocks, cellCounts: counts.cells });
  }
  /** @v2 _handleHomeSessionChange */
  handleSessionChange() {
    if (!this.active || !this.preserveHome) return;
    const scope = this.deps.scope(), invalid = !this.deps.valid();
    if (scope === this.homeScope && invalid === this.value.invalid) return;
    this.homeScope = scope; this.currentRead++; this.searchGeneration++; this.quietGeneration++; this.quietQueued = false;
    this.clearQuietCooldown(); this.homeDataReady = false; this.homeSnapshot = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.locationReads.clear(); this.locationGenerations.clear(); this.resolvedLocations.clear();
    this.searchQuery = ''; this.ordered = [];
    this.publish({ invalid, snapshot: null, selectedIndex: 0, query: '', blockCounts: {}, cellCounts: {},
      loading: !invalid, error: false });
    if (!invalid) void this.readBlocks().catch(() => {});
  }
  private clearQuietCooldown() {
    if (this.quietCooldown !== null) clearTimeout(this.quietCooldown);
    this.quietCooldown = null;
  }
  private startQuietCooldown() {
    this.clearQuietCooldown();
    this.quietCooldown = setTimeout(() => { this.quietCooldown = null; }, 30000);
  }
  routeChanged(current: boolean) {
    if (!this.active || !this.preserveHome) return;
    const shouldRefresh = this.routeKnown && current && !this.routeCurrent;
    this.routeKnown = true; this.routeCurrent = current;
    if (shouldRefresh) this.deps.afterFrame(() => { if (this.active && this.routeCurrent) this.requestQuietRefresh(); });
  }
  appResumed() { if (this.active && this.preserveHome && this.routeCurrent) this.requestQuietRefresh(); }
  /** @v2 _handleLocationsChanged */
  locationsChanged() {
    if (!this.active) return;
    if (this.preserveHome && this.homeDataReady) {
      this.quietGeneration++; this.requestQuietRefresh(true); return;
    }
    for (const [key, generation] of this.locationGenerations) this.locationGenerations.set(key, generation + 1);
    this.locationReads.clear(); this.publish(); this.refreshSearch();
  }
  /** @v2 _requestQuietRefresh */
  private requestQuietRefresh(force = false) {
    if (!this.preserveHome || !this.active || this.value.invalid) return;
    if (this.homeScope !== this.deps.scope() || !this.deps.valid()) { this.handleSessionChange(); return; }
    if (!this.homeDataReady) return;
    if (this.quietInFlight) { if (force) this.quietQueued = true; return; }
    if (!force && this.quietCooldown !== null) return;
    this.quietInFlight = true; this.quietQueued = false; this.startQuietCooldown();
    void this.refreshQuietly(this.homeScope, this.quietGeneration);
  }
  private quietCurrent(scope: string, generation: number) {
    return this.active && !this.value.invalid && this.deps.valid() && scope === this.homeScope &&
      scope === this.deps.scope() && generation === this.quietGeneration;
  }
  /** @v2 _refreshHomeQuietly */
  private async refreshQuietly(scope: string, generation: number) {
    try {
      const latest = await this.deps.blocks();
      if (!this.quietCurrent(scope, generation)) return;
      const byKey = new Map<string, QolipBlock>();
      for (const block of latest.blocks) {
        const key = qolipHomeBlockKey(block);
        if (trimDart(block.name) && !byKey.has(key)) byKey.set(key, block);
      }
      const locations = await Promise.all([...byKey].map(async ([key, block]) => {
        const locationGeneration = (this.locationGenerations.get(key) ?? 0) + 1;
        this.locationGenerations.set(key, locationGeneration);
        try { return { key, generation: locationGeneration, locations: [...await this.deps.locations(block.name)] }; }
        catch { return { key, generation: locationGeneration, locations: null }; }
      }));
      if (!this.quietCurrent(scope, generation)) return;
      if (locations.some(entry => entry.locations === null)) this.clearQuietCooldown();
      const remaining = new Map(byKey), ordered: QolipBlock[] = [];
      for (const old of this.ordered) {
        const key = qolipHomeBlockKey(old), next = remaining.get(key);
        if (next) { ordered.push(next); remaining.delete(key); }
      }
      ordered.push(...remaining.values());
      const snapshot: QolipBlocksResult = { blocks: ordered,
        warehouses: latest.warehouses.filter(warehouse => !!trimDart(warehouse)),
        supports_cross_block_move: latest.supports_cross_block_move };
      const changedBlocks = !sameQolipHomeBlocks(this.homeSnapshot, snapshot);
      const changedLocations = locations.filter(entry => entry.locations !== null &&
        this.locationGenerations.get(entry.key) === entry.generation &&
        !sameQolipHomeLocations(this.resolvedLocations.get(entry.key) ?? null, entry.locations));
      if (!changedBlocks && !changedLocations.length) return;
      const selectedKey = this.ordered[this.value.selectedIndex] ? qolipHomeBlockKey(this.ordered[this.value.selectedIndex]) : null;
      const selected = selectedKey === null ? 0 : ordered.findIndex(block => qolipHomeBlockKey(block) === selectedKey);
      if (changedBlocks) {
        this.currentRead++; this.ordered = ordered; this.homeSnapshot = snapshot;
        for (const key of this.locationReads.keys()) if (!byKey.has(key)) this.locationReads.delete(key);
        for (const key of this.resolvedLocations.keys()) if (!byKey.has(key)) this.resolvedLocations.delete(key);
        for (const key of this.locationGenerations.keys()) if (!byKey.has(key)) this.locationGenerations.delete(key);
      }
      for (const entry of changedLocations) {
        const list = entry.locations!;
        this.resolvedLocations.set(entry.key, list); this.locationReads.set(entry.key, Promise.resolve(list));
      }
      this.publish({ ...(changedBlocks ? { snapshot, selectedIndex: Math.max(0, selected) } : {}) });
      this.refreshSearch();
    } catch {
      // V2 preserves the visible snapshot and allows another try on the next return.
      if (this.quietCurrent(scope, generation)) this.clearQuietCooldown();
    } finally {
      this.quietInFlight = false;
      if (this.quietQueued && this.active) { this.quietQueued = false; this.requestQuietRefresh(true); }
    }
  }
  dispose() {
    this.active = false; this.currentRead++; this.searchGeneration++; this.quietGeneration++; this.clearQuietCooldown();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.listeners.clear();
  }
}
