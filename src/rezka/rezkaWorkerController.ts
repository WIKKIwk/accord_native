import type { AdminApparatus } from '../apparatusApi';
import { isCanonicalApparatusId } from '../workerControlsApi';
import type { RezkaAssignment, RezkaWorker } from './rezkaMasterApi';

export type RezkaTeam = { workers: RezkaWorker[]; apparatus: AdminApparatus[]; assignments: RezkaAssignment[] };
export type RezkaNotice = { key: string; values?: Record<string, string>; tone: 'success' | 'error' };
export type RezkaPicker = { worker: RezkaWorker; previous: RezkaAssignment | null; selected: string[]; saving: boolean; blocked: RezkaNotice | null };
export type RezkaWorkersState = { phase: 'loading' | 'ready' | 'error'; team: RezkaTeam | null; expandedId: string | null;
  picker: RezkaPicker | null; notice: RezkaNotice | null; savingIds: string[] };
export type RezkaWorkerDependencies = {
  isCurrent(): boolean;
  loadTeam(): Promise<{ workers: RezkaWorker[]; assignments: RezkaAssignment[] }>;
  loadApparatus(): Promise<AdminApparatus[]>;
  save(workerId: string, ids: string[], previous: string[]): Promise<void>;
};

/** @v2 canonicalApparatusIds */
export function canonicalIds(values: readonly string[]): string[] {
  return [...new Set(values.filter(isCanonicalApparatusId).map(value => value.trim()))];
}
/** @v2 canonicalApparatusDisplayLabels */
export function apparatusLabels(ids: readonly string[], apparatus: readonly AdminApparatus[]): string[] {
  const names = new Map(apparatus.filter(item => item.id.trim() && item.name.trim()).map(item => [item.id.trim(), item.name.trim()]));
  return canonicalIds(ids).map(id => names.get(id) ?? id).sort();
}
/** @v2 _saveWorkerApparatus */
export function prepareAssignment(selected: readonly string[], previous: RezkaAssignment | null, apparatus: readonly AdminApparatus[]) {
  const ids = [...new Set(selected.map(id => id.trim()).filter(Boolean))].sort();
  const old = canonicalIds(previous?.assigned_apparatus ?? []), next = canonicalIds(ids);
  const alreadySaved = previous !== null && old.length === next.length && old.every(id => next.includes(id));
  return { ids, previous: previous?.assigned_apparatus ?? [], alreadySaved, labels: apparatusLabels(ids, apparatus) };
}
function errorParts(error: unknown): { code: string; details: string[]; message: string } {
  const value = error && typeof error === 'object' ? error as { code?: unknown; details?: unknown; message?: unknown } : {};
  return { code: typeof value.code === 'string' ? value.code : '',
    details: Array.isArray(value.details) ? value.details.filter((id): id is string => typeof id === 'string') : [],
    message: typeof value.message === 'string' ? value.message : String(error) };
}

/** Master-only branch of @v2 AdminWorkerSettingsScreen and _WorkerApparatusAssignmentSheet. */
export class RezkaWorkerSettingsController {
  private state: RezkaWorkersState = { phase: 'loading', team: null, expandedId: null, picker: null, notice: null, savingIds: [] };
  private listeners = new Set<() => void>();
  private revision = 0;
  private disposed = false;
  constructor(private readonly deps: RezkaWorkerDependencies) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private active() {
    if (this.disposed) return false;
    if (!this.deps.isCurrent()) { this.invalidate(); return false; }
    return true;
  }
  private update(change: Partial<RezkaWorkersState>) {
    if (!this.active()) return;
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }
  /** Remove old-account data immediately when the session owner resets. */
  invalidate() {
    if (this.disposed) return;
    this.disposed = true; this.revision++;
    this.state = { phase: 'loading', team: null, expandedId: null, picker: null, notice: null, savingIds: [] };
    this.listeners.forEach(listener => listener());
  }
  dispose() { this.disposed = true; this.revision++; this.listeners.clear(); }
  async load(): Promise<void> {
    if (!this.active()) return;
    const revision = ++this.revision;
    this.update({ phase: 'loading' });
    try {
      const [team, apparatus] = await Promise.all([this.deps.loadTeam(), this.deps.loadApparatus()]);
      if (!this.active() || revision !== this.revision) return;
      this.update({ phase: 'ready', team: { ...team, apparatus } });
    } catch {
      if (this.active() && revision === this.revision) this.update({ phase: 'error', team: null });
    }
  }
  expand(workerId: string) {
    if (!this.active()) return;
    this.update({ expandedId: this.state.expandedId === workerId ? null : workerId });
  }
  clearNotice() { this.update({ notice: null }); }
  openPicker(workerId: string) {
    const team = this.state.team;
    if (!this.active() || this.state.phase !== 'ready' || !team || !team.apparatus.length) return;
    const worker = team.workers.find(item => item.id === workerId);
    if (!worker || !worker.id.trim() || this.state.savingIds.includes(worker.id.trim())) return;
    const assignments = new Map(team.assignments.map(item => [item.principal_ref, item]));
    const previous = assignments.get(worker.id.trim()) ?? null;
    const selected = team.apparatus.filter(item => previous?.assigned_apparatus.includes(item.id)).map(item => item.id);
    this.update({ picker: { worker, previous, selected, saving: false, blocked: null }, notice: null });
  }
  toggle(id: string, selected: boolean) {
    const picker = this.state.picker, team = this.state.team;
    if (!picker || picker.saving || !team?.apparatus.some(item => item.id === id && !!item.id)) return;
    const next = new Set(picker.selected);
    if (selected) next.add(id); else next.delete(id);
    this.update({ picker: { ...picker, selected: [...next], blocked: null } });
  }
  closePicker() {
    if (this.state.picker?.saving) return;
    this.update({ picker: null });
  }
  /** V2 still permits the platform's swipe, barrier or Back dismissal while saving. */
  dismissPicker() { this.update({ picker: null }); }
  async save(): Promise<void> {
    const picker = this.state.picker, team = this.state.team;
    if (!this.active() || !picker || picker.saving || !team || !picker.selected.length) return;
    const workerId = picker.worker.id.trim();
    if (!workerId) return;
    const values = prepareAssignment(picker.selected, picker.previous, team.apparatus);
    if (values.alreadySaved) {
      this.update({ picker: null, notice: values.ids.length
        ? { key: 'scope.already_assigned', values: { apparatus: values.labels.join(', ') }, tone: 'success' }
        : { key: 'scope.already_saved', tone: 'success' } });
      return;
    }
    this.update({ picker: { ...picker, saving: true, blocked: null }, savingIds: [...this.state.savingIds, workerId] });
    try {
      await this.deps.save(workerId, values.ids, values.previous);
      if (!this.active()) return;
      this.update({ ...(this.state.picker?.worker.id === picker.worker.id ? { picker: null } : {}),
        notice: { key: 'scope.saved', tone: 'success' } });
      await this.load();
    } catch (error) {
      if (!this.active()) return;
      const parts = errorParts(error);
      if (parts.code === 'rezka_worker_has_open_run') {
        const labels = apparatusLabels(parts.details, team.apparatus);
        const blocked: RezkaNotice = labels.length
          ? { key: 'rezka_master.rezka_worker_has_open_run_details', values: { worker: picker.worker.name, apparatus: labels.join(', ') }, tone: 'error' }
          : { key: 'rezka_master.rezka_worker_has_open_run', tone: 'error' };
        if (this.state.picker?.worker.id === picker.worker.id) this.update({ picker: { ...picker, saving: false, blocked } });
      } else if (parts.code === 'rezka_assignment_changed' || parts.code === 'worker_not_found') {
        this.update({ ...(this.state.picker?.worker.id === picker.worker.id ? { picker: null } : {}),
          notice: { key: 'rezka_master.rezka_assignment_changed', tone: 'error' } });
        await this.load();
      } else {
        const notice: RezkaNotice = parts.code === 'rezka_apparatus_required'
          ? { key: 'rezka_master.rezka_apparatus_required', tone: 'error' }
          : { key: 'scope.save_failed', values: { error: parts.message }, tone: 'error' };
        this.update({ ...(this.state.picker?.worker.id === picker.worker.id ? { picker: { ...picker, saving: false } } : {}), notice });
      }
    } finally {
      if (this.active()) this.update({ savingIds: this.state.savingIds.filter(id => id !== workerId) });
    }
  }
}
