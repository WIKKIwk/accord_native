import type { paddonFromJson } from './paddonModels';
import type { Apparatus } from './workerApi';

export type WorkerPaddon = ReturnType<typeof paddonFromJson>;
export type WorkerActivePaddonState = {
  code: string | null; selection: 'loading' | 'ready' | 'error';
  picker: 'closed' | 'loading' | 'ready' | 'error'; paddons: readonly WorkerPaddon[]; busy: boolean;
};
type Dependencies = {
  apparatus: string; current(): boolean;
  read(current: () => boolean): Promise<string | null>;
  list(current: () => boolean): Promise<readonly WorkerPaddon[]>;
  save(code: string | null, current: () => boolean): Promise<string | null>;
  failed(): void;
};

/** @v2 _workerPaddonApparatus */
export function workerPaddonApparatus(machines: readonly Apparatus[], selected: string, assigned: readonly string[]): Apparatus | null {
  const apparatus = machines.find(row => row.id === selected);
  return apparatus?.operation.trim() === 'cut' && assigned.some(id => id.trim() === apparatus.id) ? apparatus : null;
}

/** @v2 ActiveRezkaPaddonAction */
export class WorkerActivePaddon {
  private state: WorkerActivePaddonState = { code: null, selection: 'loading', picker: 'closed', paddons: [], busy: false };
  private readonly listeners = new Set<() => void>();
  private visible = false;
  private foreground = true;
  private retired = false;
  private saving = false;
  private generation = 0;
  private listGeneration = 0;
  private refreshing: Promise<void> | null = null;
  private queued = false;
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private patch(value: Partial<WorkerActivePaddonState>) { this.state = { ...this.state, ...value }; for (const listener of this.listeners) listener(); }
  private current = () => !this.retired && this.deps.current();
  private canRead = () => this.current() && this.visible && this.foreground;
  private drain() { if (this.queued && this.canRead() && !this.saving) void this.refresh(); }
  setVisible(visible: boolean) {
    const changed = this.visible !== visible;
    this.visible = visible;
    if (!visible && this.state.picker !== 'closed') this.close();
    if (changed && visible) this.notify();
  }
  setForeground(active: boolean) { const resumed = active && !this.foreground; this.foreground = active; if (resumed) this.notify(); }
  notify() { this.queued = true; this.drain(); }
  invalidate() {
    if (this.retired) return;
    this.retired = true; this.generation++; this.listGeneration++; this.queued = false;
    this.patch({ code: null, selection: 'loading', picker: 'closed', paddons: [], busy: false });
  }
  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    if (!this.canRead() || this.saving) return Promise.resolve();
    this.queued = false;
    const generation = this.generation;
    const valid = () => generation === this.generation && this.canRead();
    const task = (async () => {
      try {
        const code = await this.deps.read(valid);
        if (!valid()) return;
        this.patch({ code, selection: 'ready' });
        if (this.state.picker !== 'closed') await this.loadList();
      } catch { if (valid()) this.patch({ selection: 'error' }); }
    })();
    const pending = task.finally(() => { if (this.refreshing === pending) { this.refreshing = null; this.drain(); } });
    this.refreshing = pending;
    return pending;
  }
  private async loadList() {
    const generation = ++this.listGeneration;
    const valid = () => this.canRead() && generation === this.listGeneration && this.state.picker !== 'closed';
    this.patch({ picker: 'loading' });
    try {
      const rows = await this.deps.list(valid);
      if (valid()) this.patch({ picker: 'ready', paddons: rows.filter(row => row.apparatus_id === this.deps.apparatus && row.locked_at_unix === null && !row.contains_peremotka) });
    } catch { if (valid()) this.patch({ picker: 'error', paddons: [] }); }
  }
  async open() {
    if (this.state.busy || !this.canRead()) return;
    const generation = this.generation;
    this.patch({ busy: true });
    await this.refresh();
    if (generation !== this.generation || !this.canRead()) { if (this.current()) this.patch({ busy: false }); return; }
    this.patch({ picker: 'loading', paddons: [] });
    await this.loadList();
  }
  close() {
    this.listGeneration++;
    this.patch({ picker: 'closed', busy: this.saving });
  }
  async choose(code: string | null) {
    if (!this.canRead() || this.saving || this.state.selection !== 'ready' || this.state.picker !== 'ready' ||
        code !== null && !this.state.paddons.some(row => row.code === code)) return;
    this.saving = true;
    const generation = this.generation;
    this.close(); this.patch({ busy: true });
    const valid = () => generation === this.generation && this.canRead();
    try {
      // A production refresh that began in the picker must finish before PUT.
      await this.refreshing;
      if (!valid()) return;
      await this.deps.save(code, valid);
      if (!valid()) return;
      // The PUT result is not an optimistic choice: re-read the server like V2.
      try { const selected = await this.deps.read(valid); if (valid()) this.patch({ code: selected, selection: 'ready' }); }
      catch { if (valid()) this.patch({ selection: 'error' }); }
    } catch { if (valid()) this.deps.failed(); }
    finally { this.saving = false; if (this.current()) this.patch({ busy: false }); this.drain(); }
  }
}
