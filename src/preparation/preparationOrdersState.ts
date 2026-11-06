import { WorkerControlException } from '../workerControlsApi';
import { preparationOrderListWindowFromJson, preparationOrdersDelta, type PreparationOrderListRow, type PreparationOrderListWindow } from './preparationOrdersApi';
import type { PreparationOrdersWarmStore } from './preparationOrdersWarmStore';

type State = { window: PreparationOrderListWindow | null; rows: PreparationOrderListRow[]; apparatus: string; search: string;
  loading: boolean; error: string | null };
type Listen = (window: PreparationOrderListWindow, search: string, length: number,
  onEvent: (event: Record<string, unknown>) => void, onError: () => void, onDone: () => void) => () => void;

/** @v2 _PreparationOrdersListState */
export class PreparationOrdersState {
  private state: State = { window: null, rows: [], apparatus: '', search: '', loading: true, error: null };
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private liveGeneration = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private live: (() => void) | null = null;
  private read: Promise<void> | null = null;
  private reloadQueued = false;
  private forceQueued = false;
  private foreground = true;
  private active = true;
  private invalidated = false;
  constructor(private readonly store: PreparationOrdersWarmStore, private readonly isCurrent: () => boolean,
    private readonly listen: Listen, private readonly selectionLoader: () => Promise<string | null>) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private get current() { return this.active && !this.invalidated && this.isCurrent(); }
  private update(patch: Partial<State>) { if (!this.active) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private apply(window: PreparationOrderListWindow, persist = true, loading = false) {
    this.update({ window, apparatus: window.apparatus_id, rows: window.rows, loading, error: null });
    if (persist) this.store.remember(window, this.state.search);
  }
  async start() {
    const initial = this.store.peek({ apparatus: this.state.apparatus });
    if (initial) this.apply(initial, false);
    try {
      const apparatus = await this.selectionLoader();
      if (!this.current) return;
      if (apparatus !== null && apparatus !== this.state.apparatus) {
        this.update({ apparatus });
        const cached = this.store.peek({ apparatus });
        if (cached) this.apply(cached, false); else this.update({ window: null, rows: [] });
      }
    } catch { /* Preference failure cannot prevent the first server read. */ }
    if (!this.current) return;
    const pending = this.reload();
    void this.restore(this.generation, this.state.apparatus, this.state.search);
    await pending;
  }
  private async restore(generation: number, apparatus: string, search: string) {
    if (this.state.rows.length) return;
    const cached = await this.store.restore({ apparatus, search });
    if (!this.current || generation !== this.generation || apparatus !== this.state.apparatus || search !== this.state.search ||
        this.state.window || !this.read || this.state.error || !cached) return;
    this.apply(cached, false, this.read !== null);
  }
  sessionChanged(force = false) {
    if (!force && this.current) return;
    this.invalidated = true;
    this.generation++; this.stopLive();
    this.update({ window: null, rows: [], loading: false, error: 'Akkaunt o‘zgargan. Sahifani qayta oching.' });
  }
  setForeground(foreground: boolean) {
    this.foreground = foreground;
    if (foreground) { if (this.current) void this.reload(); } else this.stopLive();
  }
  reload(force = false): Promise<void> {
    if (this.read) { this.reloadQueued = true; this.forceQueued ||= force; return this.read; }
    return this.loadPage(false, force);
  }
  loadMore(): Promise<void> {
    if (this.read || this.state.window?.next_cursor == null) return this.read ?? Promise.resolve();
    return this.loadPage(true, false);
  }
  private loadPage(append: boolean, force: boolean): Promise<void> {
    if (!this.current) return Promise.resolve();
    const generation = ++this.generation, apparatus = this.state.apparatus, search = this.state.search;
    const previous = this.state.window, retainedLength = append ? 0 : this.state.rows.length, cursor = append ? previous?.next_cursor ?? null : null;
    this.stopLive(); this.update({ loading: true, error: null });
    let pending: Promise<void>;
    pending = (async () => {
      try {
        let next = await this.store.read({ apparatus, search, cursor, baseline: append ? null : previous, fresh: true, force });
        if (!this.current || generation !== this.generation) return;
        const matches = (a: PreparationOrderListWindow, b: PreparationOrderListWindow) =>
          a.version === b.version && a.scope === b.scope && a.epoch === b.epoch && a.apparatus_id === b.apparatus_id;
        if (append && (!previous || !matches(next, previous))) { this.reloadQueued = true; return; }
        const rows = [...next.rows], baseline = next, retained = Math.max(retainedLength, this.state.rows.length);
        while (!append && rows.length < retained && next.next_cursor !== null) {
          const used = next.next_cursor;
          const following = await this.store.read({ apparatus: baseline.apparatus_id, search, cursor: used, fresh: true });
          if (!this.current || generation !== this.generation) return;
          if (!matches(following, baseline) || following.next_cursor === used || !following.rows.length) {
            throw new WorkerControlException('preparation_orders_changed', 'Buyurtmalar o‘zgardi. Qayta yuklang.', 409);
          }
          rows.push(...following.rows); next = following;
        }
        const existing = new Set(append ? this.state.rows.map(row => row.id) : []);
        if (rows.some(row => existing.has(row.id) || !existing.add(row.id)) || (append && next.next_cursor !== null && next.next_cursor === cursor)) {
          throw new WorkerControlException('preparation_orders_invalid', 'Buyurtmalar yuklanmadi. Qayta urinib ko‘ring.');
        }
        this.apply({ ...next, rows: [...(append ? this.state.rows : []), ...rows] });
        if (this.current && generation === this.generation) this.connectLive();
      } catch (error) {
        if (!this.current || generation !== this.generation) return;
        if (append && error instanceof WorkerControlException && error.statusCode === 409) this.reloadQueued = true;
        else {
          const denied = error instanceof WorkerControlException && (error.statusCode === 401 || error.statusCode === 403);
          this.update({ error: error instanceof WorkerControlException ? error.message : 'Buyurtmalar yuklanmadi. Qayta urinib ko‘ring.',
            ...(denied ? { window: null, rows: [] } : {}) });
          if (denied) void this.store.forget({ apparatus, search });
        }
      } finally { if (this.current && generation === this.generation) this.update({ loading: false }); }
    })().finally(() => {
      if (this.read !== pending) return;
      this.read = null;
      if (this.current && this.foreground && this.reloadQueued) {
        this.reloadQueued = false; const forceNext = this.forceQueued; this.forceQueued = false; void this.reload(forceNext);
      }
    });
    this.read = pending; return pending;
  }
  changeQuery(options: { apparatus?: string; search?: string }) {
    this.generation++; this.read = null; this.reloadQueued = false; this.forceQueued = false; this.stopLive();
    const apparatus = options.apparatus ?? this.state.apparatus, search = (options.search ?? this.state.search).trim().toLowerCase();
    this.update({ apparatus, search, window: null, rows: [], loading: true });
    const cached = this.store.peek({ apparatus, search }); if (cached) this.apply(cached, false);
    const pending = this.reload(); void this.restore(this.generation, apparatus, search); return pending;
  }
  searchChanged(value: string) {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.searchTimer = null; if (this.current) void this.changeQuery({ search: value }); }, 250);
  }
  private stopLive() {
    this.liveGeneration++; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = null;
    this.live?.(); this.live = null;
  }
  private connectLive() {
    if (!this.current || !this.foreground || !this.state.window || this.state.error) return;
    this.stopLive(); const generation = this.liveGeneration;
    const reconnect = () => {
      if (!this.current || !this.foreground || generation !== this.liveGeneration) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      const delay = Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempt++, 5));
      this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; if (this.current && generation === this.liveGeneration) this.connectLive(); }, delay);
    };
    this.live = this.listen(this.state.window, this.state.search, Math.max(30, this.state.rows.length), event => {
      if (!this.current || generation !== this.liveGeneration) return;
      this.reconnectAttempt = 0;
      if (event.type === 'invalidate' || event.resync === true) { this.stopLive(); void this.reload(); }
      else if (event.type === 'error') {
        this.stopLive(); this.update({ window: null, rows: [], error: 'Buyurtmalarga kirish huquqi o‘zgargan. Qayta yuklang.' });
        void this.store.forget({ apparatus: this.state.apparatus, search: this.state.search });
      } else this.applyEvent(event);
    }, reconnect, reconnect);
  }
  private applyEvent(event: Record<string, unknown>) {
    const before = this.state.window; if (!before) return;
    if (event.epoch === before.epoch && typeof event.rev === 'number' && Number.isInteger(event.rev) && event.rev < before.rev) return;
    if (event.type === 'list_delta' && event.epoch === before.epoch && event.scope === before.scope && event.version === before.version) return;
    try {
      if (event.type === 'ready' || event.type === 'checkpoint') {
        if (event.epoch !== before.epoch || event.scope !== before.scope || (event.version != null && event.version !== before.version) ||
            typeof event.rev !== 'number' || !Number.isInteger(event.rev)) throw new Error('Preparation baseline changed');
        if (event.rev !== before.rev) { const window = { ...before, rev: event.rev }; this.update({ window }); this.store.remember(window, this.state.search); }
        if (this.state.error) this.update({ error: null });
      } else if (event.type === 'list_snapshot' || event.type === 'list_delta') {
        const next = event.type === 'list_snapshot' ? preparationOrderListWindowFromJson(event) : preparationOrdersDelta(before, event);
        if (next.search !== this.state.search) throw new Error('Preparation query changed');
        this.generation++; this.apply(next);
      }
    } catch { this.stopLive(); void this.reload(); }
  }
  dispose() {
    this.active = false; this.generation++; if (this.searchTimer) clearTimeout(this.searchTimer); this.stopLive(); this.listeners.clear();
  }
}
