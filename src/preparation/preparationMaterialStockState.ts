import type { MaterialStockPage, MaterialStockRow, MaterialStockSummary, MaterialStockTab } from './preparationMaterialStockApi';

type Window = { rows: MaterialStockRow[]; loading: boolean; loaded: boolean; error: string | null; hasMore: boolean; offset: number };
type State = { tab: MaterialStockTab; itemName: string; summary: MaterialStockSummary | null; pages: Record<MaterialStockTab, Window> };
const empty = (): Window => ({ rows: [], loading: false, loaded: false, error: null, hasMore: false, offset: 0 });
const pages = () => ({ available: empty(), receipts: empty(), issues: empty() });
export class PreparationMaterialStockState {
  private state: State = { tab: 'available', itemName: '', summary: null, pages: pages() };
  private active = true;
  private invalidated = false;
  private generation = 0;
  private requests = 0;
  private summaryRequest = 0;
  private listeners = new Set<() => void>();
  constructor(private readonly read: (tab: MaterialStockTab, offset: number) => Promise<MaterialStockPage>, private readonly current: () => boolean) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<State>) { if (!this.active) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private window(tab: MaterialStockTab, patch: Partial<Window>) { this.update({ pages: { ...this.state.pages, [tab]: { ...this.state.pages[tab], ...patch } } }); }
  activate() { this.active = true; }
  select(tab: MaterialStockTab) { this.update({ tab }); if (!this.state.pages[tab].loaded) void this.load(tab); }
  async reload() {
    if (!this.active || this.invalidated || !this.current()) return;
    this.generation++;
    const next = pages();
    for (const tab of ['available', 'receipts', 'issues'] as const) next[tab].rows = this.state.pages[tab].rows;
    this.update({ pages: next });
    await this.load(this.state.tab);
  }
  async loadMore() { const page = this.state.pages[this.state.tab]; if (page.loaded && page.hasMore) await this.load(this.state.tab, true); }
  async load(tab: MaterialStockTab, more = false) {
    const page = this.state.pages[tab];
    if (!this.active || this.invalidated || !this.current() || page.loading || (more && !page.hasMore)) return;
    const generation = this.generation, request = ++this.requests, offset = more ? page.offset : 0;
    const valid = () => this.active && !this.invalidated && this.current() && generation === this.generation;
    this.window(tab, { loading: true, error: null });
    try {
      const result = await this.read(tab, offset);
      if (!valid()) return;
      const rows = more ? [...new Map([...this.state.pages[tab].rows, ...result.rows].map(row => [row.id, row])).values()] : result.rows;
      this.window(tab, { rows, loaded: true, hasMore: result.has_more, offset: offset + result.rows.length });
      if (request >= this.summaryRequest) { this.summaryRequest = request; this.update({ summary: result.summary, itemName: result.item_name }); }
    } catch (reason) { if (valid()) this.window(tab, { error: reason instanceof Error ? reason.message : String(reason) }); }
    finally { if (valid()) this.window(tab, { loading: false }); }
  }
  invalidate() {
    this.invalidated = true; this.generation++;
    const cleared = pages(); for (const page of Object.values(cleared)) page.error = 'Akkaunt o‘zgargan. Sahifani qayta oching';
    this.update({ summary: null, itemName: '', pages: cleared });
  }
  dispose() { this.active = false; this.generation++; }
}
