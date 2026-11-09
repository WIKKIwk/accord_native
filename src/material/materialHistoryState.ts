import type { AdminApparatus } from '../apparatusApi';
import type { AdminRawMaterialEvent } from './materialHistoryApi';
import { materialHistoryErrorMessage } from './materialHistoryPresentation';

type HistoryState = { events: AdminRawMaterialEvent[]; apparatus: AdminApparatus[]; loading: boolean; refreshing: boolean; error: string | null };
type HistoryReads = { history(isCurrent: () => boolean): Promise<AdminRawMaterialEvent[]>;
  apparatus(isCurrent: () => boolean): Promise<AdminApparatus[]>; isCurrent(): boolean };

/** FutureBuilder follows the newest history future; the apparatus catalog loads independently. */
export class MaterialHistoryState {
  private state: HistoryState = { events: [], apparatus: [], loading: true, refreshing: false, error: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private historyRequest = 0;
  private active = false;
  constructor(private readonly reads: HistoryReads) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<HistoryState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private current(generation: number) { return this.active && generation === this.generation && this.reads.isCurrent(); }
  activate() { this.active = true; }
  async loadCatalog() {
    const generation = this.generation;
    const current = () => this.current(generation);
    if (!current()) return;
    try { const apparatus = await this.reads.apparatus(current); if (current()) this.update({ apparatus }); }
    catch { /* V2 keeps the exact ID hidden if the catalog cannot be loaded. */ }
  }
  async load(refresh = false) {
    if (!this.active || !this.reads.isCurrent()) return;
    const generation = this.generation, request = ++this.historyRequest;
    const current = () => this.current(generation) && request === this.historyRequest;
    this.update({ loading: true, refreshing: refresh, error: null });
    try { const events = await this.reads.history(current); if (current()) this.update({ events, loading: false, refreshing: false }); }
    catch (error) { if (current()) this.update({ events: [], loading: false, refreshing: false, error: materialHistoryErrorMessage(error) }); }
  }
  invalidate() {
    this.generation++; this.active = false;
    this.update({ events: [], apparatus: [], loading: false, refreshing: false, error: null });
  }
  dispose() { this.invalidate(); this.listeners.clear(); }
}
