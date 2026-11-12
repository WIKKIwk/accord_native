import type { Session } from './auth';
import type { AdminApparatus } from './apparatusApi';
import { assignedPaddonApparatus, resolveRezkaPaddonScope } from './rezka/rezkaPaddonScope';
import { workerPaddonCanDelete, WorkerPaddonState, type WorkerPaddon } from './workerPaddonModel';

type State = { phase: 'loading' | 'ready' | 'error'; options: AdminApparatus[]; catalog: AdminApparatus[];
  apparatus: string; name: string; rows: WorkerPaddon[]; busy: boolean; error: unknown; notice: string };
type Dependencies = { session: Session; apparatus?: string; name?: string; current(): boolean;
  catalog(current: () => boolean, force?: boolean): Promise<AdminApparatus[]>; list(apparatus: string, current: () => boolean, force?: boolean): Promise<WorkerPaddon[]>;
  create(apparatus: string, current: () => boolean): Promise<WorkerPaddon>; remove(code: string, current: () => boolean): Promise<void> };

/** @v2 _AparatchiPaddonsScreenState */
export class WorkerPaddonList extends WorkerPaddonState<State> {
  constructor(private deps: Dependencies) {
    super({ phase: 'loading', options: [], catalog: [], apparatus: deps.apparatus?.trim() ?? '', name: deps.name?.trim() ?? '',
      rows: [], busy: false, error: null, notice: '' }, deps.current);
  }
  async load(force = true) {
    if (!this.current() || this.state.busy) return;
    this.revision++; const current = this.capture();
    this.update({ phase: this.state.phase === 'ready' ? 'ready' : 'loading', error: null });
    try {
      const catalog = await this.deps.catalog(current, force); this.check(current);
      const options = assignedPaddonApparatus(catalog, this.deps.session.assigned_apparatus);
      const scope = resolveRezkaPaddonScope(options, this.state.apparatus, this.state.name);
      // A supplied route cannot authorize another worker's apparatus.
      if (scope.apparatusId && !options.some(row => row.id === scope.apparatusId)) throw new Error('apparatus_not_assigned');
      const rows = scope.needsApparatus ? [] : await this.deps.list(scope.apparatusId, current, force); this.check(current);
      this.update({ phase: 'ready', options, catalog, apparatus: scope.apparatusId, name: scope.apparatusName,
        rows: rows.filter(row => row.apparatus_id === scope.apparatusId) });
    } catch (error) { if (current()) this.update({ phase: 'error', error }); }
  }
  async select(apparatus: string) {
    if (!this.current() || this.state.busy) return;
    const option = this.state.options.find(row => row.id === apparatus); if (!option) return;
    this.update({ apparatus: option.id, name: option.name, rows: [], phase: 'loading' }); await this.load();
  }
  async create(): Promise<WorkerPaddon | null> {
    const current = this.capture(), apparatus = this.state.apparatus;
    if (!current() || this.state.busy || this.state.phase !== 'ready' || !this.state.options.some(row => row.id === apparatus)) return null;
    this.update({ busy: true, error: null });
    try { const row = await this.deps.create(apparatus, current); this.check(current);
      if (!row.code.trim() || row.apparatus_id !== apparatus) throw new Error('paddon_create'); return row;
    } catch (error) { if (current()) this.update({ error }); return null; }
    finally { if (current()) this.update({ busy: false }); }
  }
  async remove(code: string, permit = this.capture()): Promise<boolean> {
    if (!permit() || this.state.busy || !workerPaddonCanDelete(this.deps.session) || !this.state.rows.some(row => row.code === code)) return false;
    this.update({ busy: true, error: null });
    try { await this.deps.remove(code, permit); this.check(permit); this.update({ busy: false }); await this.load(); return this.current(); }
    catch (error) { if (permit()) this.update({ error }); return false; }
    finally { if (this.current()) this.update({ busy: false }); }
  }
}
