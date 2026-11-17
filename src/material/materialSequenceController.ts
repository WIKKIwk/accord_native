import type { AdminApparatus } from '../apparatusApi';
import type { AdminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { materialSequenceOrders, type MaterialSequenceSnapshot } from './materialSequenceModel';
import { workerQueueReadAuthorizationError } from '../workerQueueReadError';

export type MaterialSequenceState = { loading: boolean; error: string | null; search: string;
  apparatus: readonly AdminApparatus[]; selectedApparatus: AdminApparatus | null; snapshot: MaterialSequenceSnapshot | null };
type Dependencies = { current(): boolean; load(): Promise<{ snapshot: MaterialSequenceSnapshot; apparatus: AdminApparatus[] }>;
  loadApparatus?(): Promise<AdminApparatus[]>;
  selection: AdminSequenceApparatusStore;
  cache?: { load(): Promise<{ snapshot: MaterialSequenceSnapshot; apparatus: AdminApparatus[] } | null>;
    save(snapshot: MaterialSequenceSnapshot, apparatus: readonly AdminApparatus[]): Promise<void>; clear(): Promise<void>; flush(): Promise<void> };
  live(snapshot: () => MaterialSequenceSnapshot | null, apply: (snapshot: MaterialSequenceSnapshot) => void,
    recover: () => void, error: (error: unknown) => void, validated: () => void): () => void };

/** @v2 _AdminProductionMapOrdersScreenState (read-only Material supply sequence owner). */
export class MaterialSequenceController {
  private state: MaterialSequenceState = { loading: true, error: null, search: '', apparatus: [], selectedApparatus: null, snapshot: null };
  private listeners = new Set<() => void>();
  private disposed = false;
  private foreground = true;
  private generation = 0;
  private userSelected = false;
  private running: Promise<void> | null = null;
  private queued = false;
  private stopLive: (() => void) | null = null;
  private retiredEpochs = new Set<string>();
  private cacheAwaitingValidation = false;
  constructor(private readonly deps: Dependencies) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  current = () => !this.disposed && this.deps.current();
  private publish(change: Partial<MaterialSequenceState>) {
    if (!this.current()) return;
    this.state = { ...this.state, ...change }; this.listeners.forEach(listener => listener());
  }
  rows() { return materialSequenceOrders(this.state.snapshot, this.state.selectedApparatus, this.state.search); }
  rowsUnfiltered() { return materialSequenceOrders(this.state.snapshot, this.state.selectedApparatus); }
  async start() {
    if (!this.current()) return;
    void this.deps.selection.loadSavedApparatusId().then(() => {
      if (!this.current() || this.userSelected || !this.state.apparatus.length) return;
      const remembered = this.deps.selection.resolveApparatus(this.state.apparatus);
      if (remembered) this.publish({ selectedApparatus: remembered });
    });
    if (this.deps.cache) {
      const restored = await this.deps.cache.load();
      if (!this.current()) return;
      if (restored && !this.state.snapshot) {
        this.cacheAwaitingValidation = true; this.apply(restored.snapshot, restored.apparatus, true);
        // V2 proves the cached cursor through the stream and refreshes only
        // apparatus metadata until recovery asks for a canonical queue read.
        void this.deps.loadApparatus?.().then(apparatus => {
          if (this.current() && this.state.snapshot) this.apply(this.state.snapshot, apparatus, true);
        }).catch(() => {});
        this.connect(); return;
      }
    }
    await this.refresh(); this.connect();
  }
  searchChanged(value: string) { if (this.current()) this.publish({ search: value }); }
  selectApparatus(id: string) {
    if (!this.current()) return;
    const selected = this.state.apparatus.find(item => item.id === id);
    if (!selected) return;
    this.userSelected = true;
    this.publish({ selectedApparatus: selected });
    void this.deps.selection.saveApparatus(selected);
  }
  private apply(snapshot: MaterialSequenceSnapshot, apparatus = this.state.apparatus, restoring = false) {
    if (!this.current()) return false;
    const previous = this.state.snapshot, epoch = typeof snapshot.epoch === 'string' ? snapshot.epoch : '';
    if (epoch && this.retiredEpochs.has(epoch)) return false;
    if (previous?.epoch === epoch && typeof previous.revision === 'number' && typeof snapshot.revision === 'number' && snapshot.revision < previous.revision) return false;
    if (previous?.epoch === epoch && Object.entries(previous?.sequence_revisions ?? {}).some(([id, revision]) =>
      typeof revision === 'number' && revision > (snapshot.sequence_revisions?.[id] ?? -1))) return false;
    if (previous?.epoch && epoch && epoch !== previous.epoch) this.retiredEpochs.add(previous.epoch);
    const selected = this.state.selectedApparatus;
    const next = (selected ? this.deps.selection.resolveApparatus(apparatus, selected.id, selected.name) : null) ??
      this.deps.selection.resolveApparatus(apparatus) ?? apparatus[0] ?? null;
    if (!restoring && snapshot.materialSequenceLiveExtras && !snapshot.materialSequenceUnreconciled) this.cacheAwaitingValidation = false;
    this.publish({ snapshot, apparatus, selectedApparatus: next, error: null, loading: false });
    if (snapshot.materialSequenceLiveExtras && !snapshot.materialSequenceUnreconciled && !this.cacheAwaitingValidation) {
      void this.deps.cache?.save(snapshot, apparatus);
    }
    return true;
  }
  refresh = (): Promise<void> => {
    if (!this.current()) return Promise.resolve();
    if (this.running) { this.queued = true; return this.running; }
    const generation = this.generation;
    this.running = (async () => {
      do {
        this.queued = false;
        try {
          const value = await this.deps.load();
          if (!this.current() || generation !== this.generation) return;
          if (this.apply(value.snapshot, value.apparatus)) this.cacheAwaitingValidation = false;
        } catch (error) {
          if (this.current() && generation === this.generation) {
            if (workerQueueReadAuthorizationError(error) || (error as { code?: string })?.code === 'production_map_snapshot_contract_invalid') {
              void this.deps.cache?.clear();
              if (this.cacheAwaitingValidation) this.publish({ snapshot: null, apparatus: [], selectedApparatus: null });
              this.cacheAwaitingValidation = false;
            }
            this.publish({ loading: false, error: error instanceof Error ? error.message : String(error) });
          }
        }
      } while (this.current() && this.queued && this.foreground);
    })().finally(() => { this.running = null; });
    return this.running;
  };
  private connect() {
    this.stopLive?.(); this.stopLive = null;
    if (!this.current() || !this.foreground) return;
    this.stopLive = this.deps.live(() => this.state.snapshot, snapshot => this.apply(snapshot),
      () => { void this.refresh(); }, error => {
        if (this.current()) { if (workerQueueReadAuthorizationError(error) || (error as { code?: string })?.code === 'production_map_snapshot_contract_invalid') {
            void this.deps.cache?.clear();
            if (this.cacheAwaitingValidation) this.publish({ snapshot: null, apparatus: [], selectedApparatus: null });
            this.cacheAwaitingValidation = false;
          }
          this.publish({ loading: false, error: error instanceof Error ? error.message : String(error) }); }
      }, () => {
        if (!this.current() || !this.state.snapshot || this.state.snapshot.materialSequenceUnreconciled) return;
        this.cacheAwaitingValidation = false;
        if (this.state.snapshot.materialSequenceLiveExtras) void this.deps.cache?.save(this.state.snapshot, this.state.apparatus);
        this.publish({ error: null });
      });
  }
  setForeground(value: boolean) {
    if (this.foreground === value || !this.current()) return;
    this.foreground = value;
    if (value) { void this.refresh(); this.connect(); } else { void this.deps.cache?.flush(); this.stopLive?.(); this.stopLive = null; }
  }
  invalidate() {
    this.generation++; this.disposed = true; this.stopLive?.(); this.stopLive = null;
    this.state = { ...this.state, loading: false, snapshot: null, apparatus: [], selectedApparatus: null, error: null };
    this.listeners.forEach(listener => listener());
  }
  dispose() { void this.deps.cache?.flush(); this.invalidate(); this.listeners.clear(); }
}
