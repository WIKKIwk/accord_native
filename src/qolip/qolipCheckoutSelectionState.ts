import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import { qolipCheckoutSelection } from './qolipCheckoutLogic';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';

export type QolipCheckoutSelectionSnapshot = {
  invalid: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  selectedEntries: readonly QolipCheckoutEntry[];
  rows: readonly { entry: QolipCheckoutEntry; index: number; selected: boolean; expanded: boolean; returning: boolean }[];
  bulkReturning: boolean;
  cancelEnabled: boolean;
  bulkEnabled: boolean;
};
const invalid: QolipCheckoutSelectionSnapshot = { invalid: true, selectionMode: false, selectedIds: new Set(), selectedEntries: [], rows: [],
  bulkReturning: false, cancelEnabled: false, bulkEnabled: false };
export type QolipCheckoutLocks = { returningIds: ReadonlySet<string>; bulkReturning: boolean };

/** Read-only selection/expansion protocol. The owner must supply its real mutation locks; no write is dispatched. */
export class QolipCheckoutSelectionState {
  private readonly lifetime: QolipLocationChoiceLifetime;
  private readonly listeners = new Set<() => void>();
  private stopLifetime: (() => void) | null = null;
  private loaded: readonly QolipCheckoutEntry[];
  private visible: readonly QolipCheckoutEntry[];
  private locks: QolipCheckoutLocks;
  private selected = new Set<string>();
  private expanded: string | null = null;
  private value: QolipCheckoutSelectionSnapshot;
  private dirty = false;
  constructor(loaded: readonly QolipCheckoutEntry[], visible: readonly QolipCheckoutEntry[], locks: QolipCheckoutLocks, boundary: QolipHomeReadBoundary) {
    this.loaded = [...loaded]; this.visible = [...visible]; this.locks = { returningIds: new Set(locks.returningIds), bulkReturning: locks.bulkReturning };
    this.lifetime = new QolipLocationChoiceLifetime(boundary); this.value = this.project();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): QolipCheckoutSelectionSnapshot => {
    if (!this.lifetime.getSnapshot()) return invalid;
    // A stale FutureBuilder completion changes the source's mutable selection without setState.
    // Re-project only when somebody next reads, without sending a notification for that completion.
    if (this.dirty) {
      const next = this.project();
      if (!this.lifetime.getSnapshot()) return invalid;
      this.value = next; this.dirty = false;
    }
    return this.value;
  };
  private notify() { for (const listener of [...this.listeners]) listener(); }
  private project(): QolipCheckoutSelectionSnapshot {
    const selectionMode = this.selected.size > 0;
    return { invalid: false, selectionMode, selectedIds: new Set(this.selected),
      selectedEntries: this.loaded.filter(entry => this.selected.has(entry.id)),
      rows: this.visible.map((entry, index) => ({ entry, index, selected: this.selected.has(entry.id),
        expanded: !selectionMode && this.expanded === entry.id, returning: this.locks.returningIds.has(entry.id) })),
      bulkReturning: this.locks.bulkReturning, cancelEnabled: !this.locks.bulkReturning, bulkEnabled: selectionMode && !this.locks.bulkReturning };
  }
  private publish() {
    const next = this.project();
    if (!this.lifetime.canChoose()) return;
    this.value = next; this.dirty = false; this.notify();
  }
  activate() { this.stopLifetime ??= this.lifetime.subscribe(() => this.notify()); this.lifetime.activate(); }
  /** Every successful _loadDebts changes these internal values, even when its FutureBuilder future is stale. */
  recordLoaded(loaded: readonly QolipCheckoutEntry[]): boolean {
    if (!this.lifetime.canChoose()) return false;
    const next = [...loaded], retained = qolipCheckoutSelection(next, this.selected).retained;
    if (!this.lifetime.canChoose()) return false;
    this.loaded = next; this.selected = retained; this.dirty = true; return true;
  }
  /** Synchronize a real parent rebuild; display rows may differ from the last completed load. */
  syncPresentation(visible: readonly QolipCheckoutEntry[], locks: QolipCheckoutLocks, listMounted: boolean): boolean {
    if (!this.lifetime.canChoose()) return false;
    const nextVisible = [...visible], nextLocks = { returningIds: new Set(locks.returningIds), bulkReturning: locks.bulkReturning };
    if (!this.lifetime.canChoose()) return false;
    this.visible = nextVisible; this.locks = nextLocks;
    if (!listMounted) this.expanded = null;
    const next = this.project();
    if (!this.lifetime.canChoose()) return false;
    this.value = next; this.dirty = false; return true;
  }
  /** Standalone update for a source load followed by a parent rebuild. */
  update(loaded: readonly QolipCheckoutEntry[], visible: readonly QolipCheckoutEntry[], locks: QolipCheckoutLocks) {
    if (!this.recordLoaded(loaded) || !this.syncPresentation(visible, locks, visible.length > 0)) return;
    this.notify();
  }
  private toggle(entry: QolipCheckoutEntry) {
    if (this.locks.bulkReturning || this.locks.returningIds.has(entry.id)) return false;
    if (this.selected.has(entry.id)) this.selected.delete(entry.id); else this.selected.add(entry.id);
    return true;
  }
  tap(entry: QolipCheckoutEntry) {
    const rendered = this.getSnapshot();
    const row = rendered.rows.find(item => item.entry === entry);
    if (row) this.tapRendered(entry, rendered.selectionMode, row.expanded);
  }
  /** Flutter row handlers capture the last rendered selection mode and expanded flag. */
  tapRendered(entry: QolipCheckoutEntry, renderedSelectionMode: boolean, renderedExpanded: boolean) {
    if (!this.lifetime.canChoose() || !this.visible.includes(entry)) return;
    if (renderedSelectionMode) { if (this.toggle(entry)) this.publish(); return; }
    this.expanded = renderedExpanded ? null : entry.id; this.publish();
  }
  longPress(entry: QolipCheckoutEntry) {
    if (!this.lifetime.canChoose() || !this.visible.includes(entry)) return;
    this.expanded = null;
    if (this.toggle(entry)) this.publish();
  }
  cancel() {
    if (!this.lifetime.canChoose() || this.locks.bulkReturning) return;
    this.selected.clear(); this.publish();
  }
  /** Returns loaded source entries in source order, including duplicate IDs, with no target or network action. */
  bulkChoice(): readonly QolipCheckoutEntry[] | null {
    if (!this.lifetime.canChoose() || this.locks.bulkReturning || !this.selected.size) return null;
    const selected = this.loaded.filter(entry => this.selected.has(entry.id));
    if (selected.length) return selected;
    // V2 cancels selection if an older completion left no selected loaded rows.
    this.selected.clear(); this.publish(); return null;
  }
  canChoose(): boolean { return this.lifetime.canChoose(); }
  suspend() { const stop = this.stopLifetime; this.stopLifetime = null; stop?.(); this.lifetime.suspend(); }
}
