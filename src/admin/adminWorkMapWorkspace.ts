import type { AdminApparatus } from '../apparatusApi';
import { adminWorkMapCurrent } from './adminWorkMapCurrent';
import type { AdminSequenceApparatusStore } from '../shared/adminSequenceApparatusStore';
import { AdminWorkMapMoveController, type AdminWorkMapMoveState } from './adminWorkMapMoveController';
import { AdminWorkMapController, type AdminWorkMapModule, type AdminWorkMapPage, type AdminWorkMapRequest, type AdminWorkMapState } from './adminWorkMapController';

type Dependencies = { isCurrent: () => boolean; readCatalog: (witness: () => boolean) => Promise<AdminApparatus[]>;
  read: (request: AdminWorkMapRequest & { search: string; cursor?: string | null }, witness: () => boolean) => Promise<AdminWorkMapPage | null>;
  selection: Pick<AdminSequenceApparatusStore, 'loadSavedApparatusId' | 'resolveApparatus'> };
export type AdminWorkMapWorkspaceState = { module: AdminWorkMapModule; catalog: readonly AdminApparatus[]; selected: AdminApparatus | null;
  catalogLoading: boolean; catalogLoaded: boolean; catalogError: string | null; list: AdminWorkMapState; move: AdminWorkMapMoveState };

/** One active module owns its windows; Move has opposite read-only panes. Old row/detail tickets retire on selection. */
export class AdminWorkMapWorkspace {
  readonly window: AdminWorkMapController;
  readonly move: AdminWorkMapMoveController;
  private state: AdminWorkMapWorkspaceState;
  private listeners = new Set<() => void>();
  private started = false;
  private disposed = false;
  private invalidating = false;
  private catalogGeneration = 0;
  private stopWindow: () => void;
  constructor(private readonly deps: Dependencies) {
    this.window = new AdminWorkMapController({ isCurrent: deps.isCurrent, read: deps.read, request: null });
    this.move = new AdminWorkMapMoveController({ isCurrent: deps.isCurrent, read: deps.read });
    this.state = { module: 'sequence', catalog: [], selected: null, catalogLoading: false, catalogLoaded: false, catalogError: null,
      list: this.window.getSnapshot(), move: this.move.getSnapshot() };
    const stopList = this.window.subscribe(() => this.publish({ list: this.window.getSnapshot() }));
    const stopMove = this.move.subscribe(() => this.publish({ move: this.move.getSnapshot() }));
    this.stopWindow = () => { stopList(); stopMove(); };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<AdminWorkMapWorkspaceState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private localCurrent(generation?: number) { return !this.disposed && !this.invalidating && (generation == null || generation === this.catalogGeneration); }
  private current(generation?: number) { return this.localCurrent(generation) && adminWorkMapCurrent(this.deps.isCurrent) && this.localCurrent(generation); }
  start() { if (!this.started && !this.disposed) { this.started = true; this.window.start(); this.move.start(); void this.loadCatalog(); } }
  private configure() {
    this.move.setActive(this.state.module === 'move');
    this.window.configure(this.state.module === 'move' ? null : this.state.module !== 'sequence' ? { view: this.state.module }
      : this.state.selected ? { view: 'sequence', apparatus: this.state.selected.id } : null);
  }
  selectModule(module: AdminWorkMapModule) {
    if (!this.current() || !['sequence', 'orders', 'move', 'closed', 'audit'].includes(module) || this.state.module === module) return;
    this.state = { ...this.state, module }; this.configure(); this.publish({});
  }
  selectApparatus(id: string) {
    if (!this.current() || this.state.module !== 'sequence') return;
    const selected = this.state.catalog.find(item => item.id === id);
    if (!selected || selected === this.state.selected) return;
    this.state = { ...this.state, selected }; this.configure(); this.publish({});
    // Saving the shared cross-account fallback preference is held for a reviewed scoped adapter.
  }
  setQuery(value: string) { if (this.current()) { this.window.setQuery(value); this.move.setQuery(value); } }
  async reload() {
    if (!this.current()) return;
    if ((this.state.module === 'sequence' || this.state.module === 'move') && !this.state.catalogLoaded) return this.loadCatalog();
    return this.state.module === 'move' ? this.move.reload() : this.window.reload();
  }
  async loadCatalog() {
    if (!this.current() || this.state.catalogLoading) return;
    const generation = ++this.catalogGeneration;
    this.publish({ catalogLoading: true, catalogError: null });
    const witness = () => this.localCurrent(generation);
    try {
      if (!this.current(generation)) return;
      await this.deps.selection.loadSavedApparatusId();
      if (!this.current(generation)) return;
      const catalog = await this.deps.readCatalog(witness);
      if (!this.current(generation)) return;
      const old = this.state.selected;
      const selected = (old ? this.deps.selection.resolveApparatus(catalog, old.id, old.name) : null)
        ?? this.deps.selection.resolveApparatus(catalog) ?? catalog[0] ?? null;
      this.state = { ...this.state, catalog, selected, catalogLoading: false, catalogLoaded: true, catalogError: null };
      this.move.setCatalog(catalog); this.configure(); this.publish({});
    } catch (error) {
      if (this.current(generation)) this.publish({ catalogLoading: false, catalogError: error instanceof Error ? error.message : 'Buyurtmalar yuklanmadi' });
    }
  }
  invalidate() {
    if (this.disposed || this.invalidating) return;
    this.invalidating = true;
    try { this.catalogGeneration++; this.window.invalidate(); this.move.invalidate();
      this.publish({ catalog: [], selected: null, catalogLoading: false, catalogLoaded: false, catalogError: null }); }
    finally { this.invalidating = false; }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.catalogGeneration++;
    try { this.window.dispose(); this.move.dispose(); this.publish({ catalog: [], selected: null, catalogLoading: false, catalogLoaded: false, catalogError: null }); }
    finally { this.stopWindow(); this.listeners.clear(); }
  }
}
