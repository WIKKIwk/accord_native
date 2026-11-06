import { WorkerControlException } from '../workerControlsApi';

export type JournalPage<T, S = unknown> = { items: readonly T[]; has_more: boolean; next_offset: number | null; summary?: S };
export type JournalState<T, S = unknown> = { items: readonly T[]; loading: boolean; error: string | null; has_more: boolean; next_offset: number | null; summary: S | null };

/** @v2 _JournalState */
export class PreparationJournal<T, S = unknown> {
  state: JournalState<T, S> = { items: [], loading: true, error: null, has_more: false, next_offset: null, summary: null };
  private readonly scope: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private epoch = 0;
  private loadedPages = 0;
  private busy = false;
  private queued = false;
  private valid = true;
  private disposed = false;
  private visible = true;
  private resumed = true;

  constructor(private readonly request: (offset: number) => Promise<JournalPage<T, S>>,
    private readonly identity: (item: T) => string, private readonly currentScope: () => string,
    private readonly changed: (state: JournalState<T, S>) => void) {
    this.scope = currentScope();
  }
  private get current(): boolean { return this.valid && !this.disposed && this.scope === this.currentScope(); }
  private update(patch: Partial<JournalState<T, S>>) { this.state = { ...this.state, ...patch }; this.changed(this.state); }
  start(): void {
    if (this.timer || this.disposed) return;
    void this.load();
    this.timer = setInterval(() => { if (this.current && this.visible && this.resumed && !this.busy) void this.load({ silent: true }); }, 15000);
  }
  setVisible(visible: boolean): void { this.visible = visible; }
  setResumed(resumed: boolean): void {
    const wasPaused = !this.resumed; this.resumed = resumed;
    if (wasPaused && resumed && this.current && this.visible && !this.busy) void this.load({ silent: true });
  }
  sessionChanged(force = false): void {
    if (!force && this.current) return;
    this.invalidate();
  }
  invalidate(): void {
    if (!this.valid || this.disposed) return;
    this.valid = false; this.epoch++; this.queued = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.update({ items: [], summary: null, has_more: false, loading: false, error: 'Akkaunt o‘zgargan. Sahifani qayta oching' });
  }
  async load(options: { append?: boolean; silent?: boolean } = {}): Promise<void> {
    if (!this.current) return;
    const append = options.append ?? false, silent = options.silent ?? false;
    if (this.busy) {
      if (!silent && !append) { this.epoch++; this.queued = true; }
      return;
    }
    let offset: number | null = append ? this.state.next_offset : 0;
    if (offset === null) return;
    const epoch = ++this.epoch;
    this.busy = true;
    if (!silent) this.update({ loading: true, error: null });
    try {
      const refreshPages = silent && !append && this.loadedPages > 0 ? this.loadedPages : 1;
      const refreshed: T[] = [];
      let pages = 0, result: JournalPage<T, S>;
      do {
        result = await this.request(offset);
        if (!this.current || epoch !== this.epoch) return;
        if (result.has_more && (result.next_offset ?? 0) <= offset) throw new Error('Keyingi sahifa ma’lumoti noto‘g‘ri');
        refreshed.push(...result.items); pages++;
        if (!result.has_more) break;
        offset = result.next_offset!;
      } while (pages < refreshPages);
      const merged = new Map<string, T>();
      if (append) for (const item of this.state.items) merged.set(this.identity(item), item);
      for (const item of refreshed) merged.set(this.identity(item), item);
      this.loadedPages = append ? this.loadedPages + pages : pages;
      this.update({ items: [...merged.values()], has_more: result.has_more, next_offset: result.next_offset,
        error: null, summary: result.summary === undefined ? this.state.summary : result.summary });
    } catch (error) {
      if (this.current && epoch === this.epoch) this.update({ error: error instanceof WorkerControlException
        ? error.message : 'Ma’lumotlarni yuklab bo‘lmadi. Qayta urinib ko‘ring' });
    } finally {
      this.busy = false;
      if (this.current) {
        this.update({ loading: false });
        if (this.queued) { this.queued = false; void this.load(); }
      }
    }
  }
  dispose(): void {
    this.disposed = true; this.epoch++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
