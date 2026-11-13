import type { MetalayzerMaterial, MetalayzerPage } from './metalayzerApi';

export type MetalayzerListSnapshot = {
  items: MetalayzerMaterial[]; cursor: string | null; loading: boolean; moreLoading: boolean; error: string | null; moreError: string | null;
};
type Reads = { isCurrent(): boolean; page(cursor: string | null, current: () => boolean): Promise<MetalayzerPage> };
const initial = (): MetalayzerListSnapshot => ({ items: [], cursor: null, loading: true, moreLoading: false, error: null, moreError: null });
const message = (error: unknown) => error instanceof Error && error.message ? error.message : 'Ro‘yxatni yuklab bo‘lmadi';

export class MetalayzerListState {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private active = false;
  constructor(private readonly reads: Reads) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<MetalayzerListSnapshot>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private current(generation: number) { return this.active && this.generation === generation && this.reads.isCurrent(); }
  activate() { this.active = true; }
  async reload() {
    if (!this.active || !this.reads.isCurrent()) return;
    const generation = ++this.generation, current = () => this.current(generation);
    this.update({ loading: true, moreLoading: false, error: null, moreError: null });
    try {
      const page = await this.reads.page(null, current);
      if (current()) this.update({ items: page.items, cursor: page.nextCursor, loading: false });
    } catch (error) { if (current()) this.update({ loading: false, error: message(error) }); }
  }
  async loadMore() {
    const { cursor, loading, moreLoading } = this.state;
    if (!cursor || loading || moreLoading || !this.active || !this.reads.isCurrent()) return;
    const generation = this.generation, current = () => this.current(generation);
    this.update({ moreLoading: true, moreError: null });
    try {
      const page = await this.reads.page(cursor, current);
      if (!current()) return;
      const seen = new Set(this.state.items.map(item => item.barcode.toLowerCase()));
      const items = [...this.state.items];
      for (const item of page.items) if (!seen.has(item.barcode.toLowerCase())) { seen.add(item.barcode.toLowerCase()); items.push(item); }
      this.update({ items, cursor: page.nextCursor, moreLoading: false });
    } catch (error) { if (current()) this.update({ moreLoading: false, moreError: message(error) }); }
  }
  invalidate() { this.active = false; this.generation++; this.state = initial(); this.listeners.forEach(listener => listener()); }
}
