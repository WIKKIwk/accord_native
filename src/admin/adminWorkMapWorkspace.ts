import type { AdminApparatus } from '../apparatusApi';
import type { AdminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { AdminWorkMapController, type AdminWorkMapModule, type AdminWorkMapPage, type AdminWorkMapRequest, type AdminWorkMapState } from './adminWorkMapController';

type Dependencies = { isCurrent: () => boolean; readCatalog: () => Promise<AdminApparatus[]>;
  read: (request: AdminWorkMapRequest & { search: string; cursor?: string | null }) => Promise<AdminWorkMapPage | null>;
  selection: Pick<AdminSequenceApparatusStore, 'loadSavedApparatusId' | 'resolveApparatus'> };
export type AdminWorkMapWorkspaceState = { module: AdminWorkMapModule; catalog: readonly AdminApparatus[]; selected: AdminApparatus | null;
  catalogLoading: boolean; catalogLoaded: boolean; catalogError: string | null; list: AdminWorkMapState };

/** One active server window. Selecting another module/apparatus retires every old row/detail ticket. */
export class AdminWorkMapWorkspace {
  readonly window: AdminWorkMapController;
  private state: AdminWorkMapWorkspaceState;
  private listeners = new Set<() => void>();
  private started = false;
  private disposed = false;
  private catalogGeneration = 0;
  private stopWindow: () => void;
  constructor(private readonly deps: Dependencies) {
    this.window = new AdminWorkMapController({ isCurrent: deps.isCurrent, read: deps.read, request: null });
    this.state = { module: 'sequence', catalog: [], selected: null, catalogLoading: false, catalogLoaded: false, catalogError: null,
      list: this.window.getSnapshot() };
    this.stopWindow = this.window.subscribe(() => this.publish({ list: this.window.getSnapshot() }));
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWorkMapWorkspaceState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private current(generation?: number) { return !this.disposed && this.deps.isCurrent() && (generation == null || generation === this.catalogGeneration); }
  start() { if (!this.started && !this.disposed) { this.started = true; this.window.start(); void this.loadCatalog(); } }
  private configure() {
    this.window.configure(this.state.module === 'orders' ? { view: 'orders' }
      : this.state.selected ? { view: 'sequence', apparatus: this.state.selected.id } : null);
  }
  selectModule(module: AdminWorkMapModule) {
    if (!this.current() || !['sequence', 'orders'].includes(module) || this.state.module === module) return;
    this.state = { ...this.state, module }; this.configure(); this.publish({});
  }
  selectApparatus(id: string) {
    if (!this.current() || this.state.module !== 'sequence') return;
    const selected = this.state.catalog.find(item => item.id === id);
    if (!selected || selected === this.state.selected) return;
    this.state = { ...this.state, selected }; this.configure(); this.publish({});
    // Saving the shared cross-account fallback preference is held for a reviewed scoped adapter.
  }
  async reload() {
    if (!this.current()) return;
    if (this.state.module === 'sequence' && !this.state.catalogLoaded) return this.loadCatalog();
    return this.window.reload();
  }
  async loadCatalog() {
    if (!this.current() || this.state.catalogLoading) return;
    const generation = ++this.catalogGeneration;
    this.publish({ catalogLoading: true, catalogError: null });
    try {
      await this.deps.selection.loadSavedApparatusId();
      if (!this.current(generation)) return;
      const catalog = await this.deps.readCatalog();
      if (!this.current(generation)) return;
      const old = this.state.selected;
      const selected = (old ? this.deps.selection.resolveApparatus(catalog, old.id, old.name) : null)
        ?? this.deps.selection.resolveApparatus(catalog) ?? catalog[0] ?? null;
      this.state = { ...this.state, catalog, selected, catalogLoading: false, catalogLoaded: true, catalogError: null };
      this.configure(); this.publish({});
    } catch (error) {
      if (this.current(generation)) this.publish({ catalogLoading: false, catalogError: error instanceof Error ? error.message : 'Buyurtmalar yuklanmadi' });
    }
  }
  invalidate() {
    if (this.disposed) return;
    this.catalogGeneration++; this.window.invalidate();
    this.publish({ catalog: [], selected: null, catalogLoading: false, catalogLoaded: false, catalogError: null });
  }
  dispose() { this.invalidate(); this.disposed = true; this.stopWindow(); this.window.dispose(); this.listeners.clear(); }
}
