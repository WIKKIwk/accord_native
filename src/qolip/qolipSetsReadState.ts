import { trimDart, type QolipReadGuard } from './qolipApiCommon';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';
import type { QolipManagedSet } from './qolipSetsApi';

export type QolipSetsReadActions = {
  setSearch: (value: string) => void;
  tap: (entry: QolipManagedSet, renderedExpanded: boolean) => void;
};
export type QolipSetsReadSnapshot = {
  invalid: boolean;
  loading: boolean;
  error: boolean;
  search: string;
  saving: boolean;
  rows: readonly { entry: QolipManagedSet; expanded: boolean }[];
  actions: QolipSetsReadActions | null;
};
const invalid: QolipSetsReadSnapshot = Object.freeze({ invalid: true, loading: false, error: false, search: '', saving: false, rows: [], actions: null });
type Run = { active: boolean; serial: number; unsubscribe: (() => void) | null; actions: QolipSetsReadActions };
function safelyInvoke(callback: () => unknown) {
  try {
    const result = callback();
    if (result && (typeof result === 'object' || typeof result === 'function') &&
        typeof (result as { then?: unknown }).then === 'function') void Promise.resolve(result).catch(() => {});
  } catch { /* Other observers and cleanup must still run. */ }
}

// Dart's source uses simple lowercase rather than JavaScript's context-sensitive final sigma
// and U+0130 expansion. Device Unicode-table versions still need native verification.
function setsLower(value: string): string {
  return [...value].map(character => character === '\u0130' ? 'i' : character.toLowerCase()).join('');
}

/** @v2 _QolipSetsScreenState.build */
export function qolipFilterManagedSets(entries: readonly QolipManagedSet[], search: string): QolipManagedSet[] {
  const query = setsLower(trimDart(search));
  return entries.filter(entry => entry.set.members.length > 0 &&
    [entry.name, entry.set.id, ...entry.set.members.map(member => member.qolip_code)]
      .some(value => setsLower(value).includes(query)));
}

/** Unrouted read/search/expansion lifetime. No create, edit, delete, copy or retry callback is exposed. */
export class QolipSetsReadState {
  private readonly lifetime: QolipLocationChoiceLifetime;
  private readonly listeners = new Set<() => void>();
  private run: Run | null = null;
  private entries: readonly QolipManagedSet[] = [];
  private search = '';
  private expanded: string | null = null;
  private saving: boolean;
  private loading = true;
  private error = false;
  private value: QolipSetsReadSnapshot = invalid;
  constructor(boundary: QolipHomeReadBoundary, private readonly read: (guard: QolipReadGuard) => Promise<readonly QolipManagedSet[]>, saving: boolean) {
    this.lifetime = new QolipLocationChoiceLifetime(boundary); this.saving = saving;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): QolipSetsReadSnapshot => {
    const run = this.run;
    return run?.active && this.lifetime.getSnapshot() && this.run === run && run.active ? this.value : invalid;
  };
  private notify() { for (const listener of [...this.listeners]) safelyInvoke(listener); }
  private close(run: Run) {
    run.active = false; run.serial++;
    const unsubscribe = run.unsubscribe; run.unsubscribe = null;
    if (unsubscribe) safelyInvoke(unsubscribe);
    this.lifetime.suspend();
  }
  private invalidate(run: Run) {
    if (this.run !== run || !run.active) return;
    this.close(run); this.entries = []; this.search = ''; this.expanded = null; this.value = invalid; this.notify();
  }
  private current(run: Run): boolean {
    if (this.run !== run || !run.active) return false;
    if (!this.lifetime.canChoose()) { this.invalidate(run); return false; }
    return this.run === run && run.active;
  }
  private publish(run: Run) {
    if (!this.current(run)) return;
    // This FutureBuilder shows a spinner for every pending replacement, even if it retained data.
    const rows = this.loading || this.error ? [] : qolipFilterManagedSets(this.entries, this.search)
      .map(entry => ({ entry, expanded: this.expanded === entry.set.id }));
    if (!this.current(run)) return;
    this.value = { invalid: false, loading: this.loading, error: this.error, search: this.search,
      saving: this.saving, rows, actions: run.actions }; this.notify();
  }
  activate(): () => void {
    if (this.run?.active) return () => {};
    const run = { active: true, serial: 0, unsubscribe: null } as Run;
    run.actions = Object.freeze({
      setSearch: value => { if (this.current(run)) { this.search = value; this.publish(run); } },
      tap: (entry, renderedExpanded) => {
        if (!this.current(run) || this.loading || this.error || this.saving || !this.value.rows.some(row => row.entry === entry)) return;
        this.expanded = renderedExpanded ? null : entry.set.id; this.publish(run);
      },
    });
    this.run = run;
    const suspend = () => { if (this.run !== run || !run.active) return; this.close(run); this.value = invalid; this.notify(); };
    run.unsubscribe = this.lifetime.subscribe(() => this.invalidate(run));
    this.lifetime.activate();
    if (!this.current(run)) return suspend;
    void this.reload(); return suspend;
  }
  /** Only the real owner of source mutations supplies this lock; this method performs no mutation. */
  updateSaving(saving: boolean) {
    const run = this.run; if (!run || !this.current(run)) return;
    this.saving = saving; this.publish(run);
  }
  /** Model of a source future replacement; not connected to a retry or refresh control. */
  async reload(): Promise<void> {
    const run = this.run; if (!run || !this.current(run)) return;
    const serial = ++run.serial, guard = () => this.current(run);
    this.loading = true; this.error = false; this.publish(run);
    if (!guard()) return;
    try {
      const entries = await this.read(guard);
      if (!guard() || run.serial !== serial) return;
      const next = [...entries];
      if (!guard() || run.serial !== serial) return;
      this.entries = next; this.loading = false; this.error = false; this.publish(run);
    } catch {
      if (!guard() || run.serial !== serial) return;
      this.entries = []; this.loading = false; this.error = true; this.publish(run);
    }
  }
}
