import type { SupplierItem } from '../shared/catalogApi';

export type RezkaItemPickerState = { query: string; items: SupplierItem[]; loading: boolean };
export type RezkaItemPickerDependencies = { isCurrent(): boolean; load(query: string, limit: number): Promise<SupplierItem[]>;
  schedule?(callback: () => void, milliseconds: number): () => void };

/** Search behavior from @v2 _RezkaItemPickerSheetState. */
export class RezkaItemPickerController {
  private state: RezkaItemPickerState = { query: '', items: [], loading: true };
  private listeners = new Set<() => void>();
  private disposed = false;
  private started = false;
  private searchGeneration = 0;
  private loadGeneration = 0;
  private cancelTimer: (() => void) | null = null;
  constructor(private readonly deps: RezkaItemPickerDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private active() {
    if (this.disposed) return false;
    if (!this.deps.isCurrent()) { this.invalidate(); return false; }
    return true;
  }
  private update(change: Partial<RezkaItemPickerState>) {
    if (!this.active()) return;
    this.state = { ...this.state, ...change }; this.listeners.forEach(listener => listener());
  }
  invalidate() {
    if (this.disposed) return;
    this.disposed = true; this.cancelTimer?.(); this.cancelTimer = null; this.loadGeneration++;
    this.state = { query: '', items: [], loading: false }; this.listeners.forEach(listener => listener());
  }
  dispose() { this.disposed = true; this.cancelTimer?.(); this.cancelTimer = null; this.loadGeneration++; this.listeners.clear(); }
  start() {
    if (!this.active() || this.started) return;
    this.started = true; void this.load(this.state.query);
  }
  setQuery(query: string) { this.update({ query }); this.search(220); }
  submit() { this.search(0); }
  private search(delay: number) {
    if (!this.active()) return;
    this.cancelTimer?.(); this.cancelTimer = null;
    const query = this.state.query, generation = ++this.searchGeneration;
    const run = () => { this.cancelTimer = null; if (this.active() && generation === this.searchGeneration) void this.load(query); };
    if (!delay) { run(); return; }
    if (this.deps.schedule) this.cancelTimer = this.deps.schedule(run, delay);
    else { const timer = setTimeout(run, delay); this.cancelTimer = () => clearTimeout(timer); }
  }
  private async load(query: string) {
    const generation = ++this.loadGeneration;
    this.update({ loading: true });
    try {
      const items = await this.deps.load(query, 30);
      if (this.active() && generation === this.loadGeneration) this.update({ items, loading: false });
    } catch {
      // V2's FutureBuilder has no separate error surface: failed loads appear empty.
      if (this.active() && generation === this.loadGeneration) this.update({ items: [], loading: false });
    }
  }
}
