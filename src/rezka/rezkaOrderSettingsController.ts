import { WorkerControlException } from '../workerControlsApi';
import { RezkaScopeChanged } from './rezkaSessionGuard';

export type RezkaOrderOption = 'duplicateLabels' | 'includeBobina' | 'printSide';
export type RezkaOrderValues = { duplicateLabels: boolean; includeBobina: boolean; standardPrintSide: boolean };
export type RezkaOrderConfirmation = Readonly<{ option: RezkaOrderOption; enabled: boolean }>;
export type RezkaOrderError = { kind: 'production' | 'admin' | 'raw' | 'uncertain'; key: string };
export type RezkaOrderSettingsState = { values: RezkaOrderValues | null; showWorkOptions: boolean; pending: RezkaOrderConfirmation | null;
  saving: boolean; needsReopen: boolean; error: RezkaOrderError | null };

/** One app-process lock spans quick-settings instances; unknown outcomes intentionally have no automatic unlock. */
export class RezkaOrderWriteLocks {
  private readonly locks = new Map<string, 'sending' | 'uncertain'>();
  status(key: string) { return this.locks.get(key) ?? null; }
  begin(key: string) { if (this.locks.has(key)) return false; this.locks.set(key, 'sending'); return true; }
  complete(key: string) { this.locks.delete(key); }
  markUncertain(key: string) { this.locks.set(key, 'uncertain'); }
}
export const rezkaOrderWriteLocks = new RezkaOrderWriteLocks();
export type RezkaOrderSettingsDependencies = {
  isCurrent(): boolean;
  savePrintSide(standard: boolean, previous: boolean): Promise<void>;
  saveOptions(next: RezkaOrderValues, previous: RezkaOrderValues): Promise<void>;
  onSaved(): void;
  locks: RezkaOrderWriteLocks;
  lockKey: string;
};
const conflicts = new Set(['print_side_changed', 'rezka_order_settings_changed', 'rezka_order_settings_order_finished']);
const rejected = new Set([...conflicts, 'rezka_weight_mode_run_active']);
function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
}
function resultError(error: unknown): RezkaOrderError {
  const code = errorCode(error);
  if (code === 'print_side_changed') return { kind: 'production', key: 'order.print_side.changed' };
  if (rejected.has(code)) return { kind: 'admin', key: `rezka_master.${code}` };
  return { kind: 'uncertain', key: '' };
}

/** @v2 _RezkaOrderQuickSettings. The host owns the surrounding existing worker sheet. */
export class RezkaOrderSettingsController {
  private state: RezkaOrderSettingsState;
  private listeners = new Set<() => void>();
  private disposed = false;
  private mounted = true;
  constructor(values: RezkaOrderValues, showWorkOptions: boolean, private readonly deps: RezkaOrderSettingsDependencies) {
    this.state = { values: { ...values }, showWorkOptions, pending: null, saving: false, needsReopen: false, error: null };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private active() {
    if (this.disposed || !this.mounted) return false;
    if (!this.deps.isCurrent()) { this.invalidate(); return false; }
    return true;
  }
  private update(change: Partial<RezkaOrderSettingsState>) {
    if (!this.active()) return;
    this.state = { ...this.state, ...change }; this.listeners.forEach(listener => listener());
  }
  invalidate() {
    if (this.disposed) return;
    this.disposed = true;
    this.state = { values: null, showWorkOptions: false, pending: null, saving: false, needsReopen: true, error: null };
    this.listeners.forEach(listener => listener());
  }
  suspend() { this.mounted = false; }
  resume() { if (!this.disposed) this.mounted = true; }
  dispose() { this.disposed = true; this.mounted = false; this.listeners.clear(); }
  request(option: RezkaOrderOption, enabled: boolean): RezkaOrderConfirmation | null {
    if (!this.active() || !this.state.values || this.state.pending || this.state.saving || this.state.needsReopen ||
        (!this.state.showWorkOptions && option !== 'printSide')) return null;
    if (this.deps.locks.status(this.deps.lockKey)) {
      this.update({ needsReopen: true, error: { kind: 'uncertain', key: '' } });
      return null;
    }
    const pending = Object.freeze({ option, enabled });
    this.update({ pending, error: null });
    return pending;
  }
  cancel(pending: RezkaOrderConfirmation) {
    if (this.state.pending === pending) this.update({ pending: null });
  }
  async confirm(pending: RezkaOrderConfirmation): Promise<void> {
    const previous = this.state.values;
    if (!this.active() || !previous || this.state.pending !== pending || this.state.saving || this.state.needsReopen) return;
    if (!this.deps.locks.begin(this.deps.lockKey)) {
      this.update({ pending: null, needsReopen: true, error: { kind: 'uncertain', key: '' } }); return;
    }
    this.update({ pending: null, saving: true, error: null });
    const next = { ...previous, ...(pending.option === 'printSide' ? { standardPrintSide: pending.enabled }
      : pending.option === 'duplicateLabels' ? { duplicateLabels: pending.enabled } : { includeBobina: pending.enabled }) };
    try {
      if (pending.option === 'printSide') await this.deps.savePrintSide(next.standardPrintSide, previous.standardPrintSide);
      else await this.deps.saveOptions(next, previous);
    } catch (error) {
      const serverRejected = error instanceof WorkerControlException && error.statusCode != null && error.statusCode >= 400 &&
        error.statusCode < 500 && rejected.has(errorCode(error));
      const known = serverRejected || (error instanceof RezkaScopeChanged && !error.mayHaveExecuted);
      if (known) this.deps.locks.complete(this.deps.lockKey); else this.deps.locks.markUncertain(this.deps.lockKey);
      if (this.active()) this.update({ saving: false, error: serverRejected ? resultError(error) : { kind: 'uncertain', key: '' }, needsReopen: !known || conflicts.has(errorCode(error)) });
      return;
    }
    if (!this.deps.isCurrent()) {
      this.deps.locks.markUncertain(this.deps.lockKey); this.invalidate(); return;
    }
    this.deps.locks.complete(this.deps.lockKey);
    if (!this.active()) return;
    this.update({ saving: false, values: next });
    this.deps.onSaved();
  }
}
