import type { Session } from './auth';
import type { AdminApparatus } from './apparatusApi';
import { assignedPaddonApparatus } from './rezka/rezkaPaddonScope';
import { workerPaddonEditable, workerPaddonMovable, WorkerPaddonError, WorkerPaddonState, type WorkerPaddon, type WorkerPaddonSnapshot } from './workerPaddonModel';

type State = { phase: 'loading' | 'ready' | 'error'; busy: boolean; catalog: AdminApparatus[]; rows: WorkerPaddon[];
  source: WorkerPaddonSnapshot | null; target: WorkerPaddonSnapshot | null; selectedCode: string; selected: string[]; error: unknown };
type Dependencies = { session: Session; apparatus: string; current(): boolean; catalog(current: () => boolean, force?: boolean): Promise<AdminApparatus[]>;
  list(apparatus: string, current: () => boolean): Promise<WorkerPaddon[]>; read(code: string, current: () => boolean): Promise<WorkerPaddonSnapshot>;
  move(source: string, target: string, ids: string[], current: () => boolean): Promise<void>; changed(): void };

/** @v2 _AparatchiPaddonTransferScreenState */
export class WorkerPaddonTransfer extends WorkerPaddonState<State> {
  constructor(private deps: Dependencies) {
    super({ phase: 'loading', busy: false, catalog: [], rows: [], source: null, target: null, selectedCode: '', selected: [], error: null }, deps.current);
  }
  editable(snapshot: WorkerPaddonSnapshot | null) { return workerPaddonEditable(snapshot, this.deps.session); }
  private checked(snapshot: WorkerPaddonSnapshot, code: string) {
    if (snapshot.paddon.code !== code || !this.deps.session.assigned_apparatus.includes(snapshot.paddon.apparatus_id)) throw new Error('paddon_transfer_forbidden'); return snapshot;
  }
  private async reload(force = true) {
    this.revision++; const current = this.capture(); this.update({ phase: 'loading', selected: [], selectedCode: '', error: null });
    try {
      const catalog = await this.deps.catalog(current, force); this.check(current);
      const assigned = assignedPaddonApparatus(catalog, this.deps.session.assigned_apparatus);
      const pages = await Promise.all(assigned.map(async row => {
        this.check(current); const page = await this.deps.list(row.id, current); this.check(current); return page.filter(item => item.apparatus_id === row.id);
      })); this.check(current);
      const rows = pages.flat().filter(row => row.locked_at_unix == null), codes = new Set(rows.map(row => row.code));
      const source = this.state.source && codes.has(this.state.source.paddon.code) ? this.state.source.paddon.code
        : (rows.find(row => row.apparatus_id === this.deps.apparatus) ?? rows[0])?.code;
      const target = this.state.target && codes.has(this.state.target.paddon.code) && this.state.target.paddon.code !== source
        ? this.state.target.paddon.code : rows.find(row => row.code !== source)?.code;
      const read = async (code?: string) => { if (!code) return null; this.check(current); const snapshot = await this.deps.read(code, current); this.check(current); return this.checked(snapshot, code); };
      const [from, to] = await Promise.all([read(source), read(target)]); this.check(current);
      this.update({ phase: 'ready', catalog, rows, source: from, target: to });
    } catch (error) { if (current()) this.update({ phase: 'error', error }); }
  }
  async load(force = true) { if (this.current() && !this.state.busy) await this.reload(force); }
  async pick(side: 'source' | 'target', code: string, permit = this.capture()) {
    const other = side === 'source' ? this.state.target : this.state.source;
    if (!permit() || this.state.busy || !this.state.rows.some(row => row.code === code) || other?.paddon.code === code) return;
    this.update({ busy: true, selected: [], error: null });
    try { const snapshot = this.checked(await this.deps.read(code, permit), code); this.check(permit);
      if (!this.editable(snapshot)) throw new WorkerPaddonError(snapshot.paddon.locked_at_unix != null ? 'paddon_locked' : !snapshot.can_manage_items ? 'paddon_already_received' : 'paddon_transfer_forbidden');
      this.update({ [side]: snapshot });
    } catch (error) { if (permit()) this.update({ error }); }
    finally { if (permit()) this.update({ busy: false }); }
  }
  toggle(code: string, id: string) {
    if (!this.current() || this.state.busy) return;
    const snapshot = [this.state.source, this.state.target].find(row => row?.paddon.code === code);
    if (!snapshot || !this.editable(snapshot) || !snapshot.items.some(row => row.batch_id === id && workerPaddonMovable(row))) return;
    const selected = this.state.selectedCode === code ? this.state.selected : [];
    this.update({ selectedCode: code, selected: selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id] });
  }
  async move(source: string, target: string, ids: string[], permit = this.capture()) {
    if (!permit() || this.state.busy || !ids.length || source === target || !this.editable(this.state.source) || !this.editable(this.state.target)) return false;
    const pair = new Set([this.state.source!.paddon.code, this.state.target!.paddon.code]);
    if (!pair.has(source) || !pair.has(target)) return false;
    const from = [this.state.source!, this.state.target!].find(row => row.paddon.code === source)!;
    if (ids.some(id => !from.items.some(row => row.batch_id === id && workerPaddonMovable(row)))) return false;
    this.update({ busy: true, error: null });
    let error: unknown = null;
    try { await this.deps.move(source, target, [...new Set(ids)], permit); this.check(permit); this.deps.changed(); }
    catch (failure) { error = failure; }
    if (!permit()) return false;
    // A timeout can follow a committed transfer. Both sides are reloaded and
    // selection is cleared before another explicit transfer is possible.
    await this.reload();
    if (this.current()) this.update({ busy: false, ...(error ? { error } : {}) });
    return !error && this.current();
  }
}
