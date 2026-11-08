import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import { qolipCheckoutSelection } from './qolipCheckoutLogic';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';

type Snapshot = {
  invalid: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  selectedEntries: readonly QolipCheckoutEntry[];
  rows: readonly { entry: QolipCheckoutEntry; index: number; selected: boolean; expanded: boolean; returning: boolean }[];
  bulkReturning: boolean;
  cancelEnabled: boolean;
  bulkEnabled: boolean;
};
const invalid: Snapshot = { invalid: true, selectionMode: false, selectedIds: new Set(), selectedEntries: [], rows: [],
  bulkReturning: false, cancelEnabled: false, bulkEnabled: false };
type Locks = { returningIds: ReadonlySet<string>; bulkReturning: boolean };

/** Read-only selection/expansion protocol. The owner must supply its real mutation locks; no write is dispatched. */
export class QolipCheckoutSelectionState {
  private readonly lifetime: QolipLocationChoiceLifetime;
  private readonly listeners = new Set<() => void>();
  private stopLifetime: (() => void) | null = null;
  private loaded: readonly QolipCheckoutEntry[];
  private visible: readonly QolipCheckoutEntry[];
  private locks: Locks;
  private selected = new Set<string>();
  private expanded: string | null = null;
  private value: Snapshot;
  constructor(loaded: readonly QolipCheckoutEntry[], visible: readonly QolipCheckoutEntry[], locks: Locks, boundary: QolipHomeReadBoundary) {
    this.loaded = [...loaded]; this.visible = [...visible]; this.locks = { returningIds: new Set(locks.returningIds), bulkReturning: locks.bulkReturning };
    this.lifetime = new QolipLocationChoiceLifetime(boundary); this.value = this.project();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): Snapshot => this.lifetime.getSnapshot() ? this.value : invalid;
  private notify() { for (const listener of [...this.listeners]) listener(); }
  private project(): Snapshot {
    const selectionMode = this.selected.size > 0;
    return { invalid: false, selectionMode, selectedIds: new Set(this.selected),
      selectedEntries: this.loaded.filter(entry => this.selected.has(entry.id)),
      rows: this.visible.map((entry, index) => ({ entry, index, selected: this.selected.has(entry.id),
        expanded: !selectionMode && this.expanded === entry.id, returning: this.locks.returningIds.has(entry.id) })),
      bulkReturning: this.locks.bulkReturning, cancelEnabled: !this.locks.bulkReturning, bulkEnabled: selectionMode && !this.locks.bulkReturning };
  }
  private publish() { this.value = this.project(); this.notify(); }
  activate() { this.stopLifetime ??= this.lifetime.subscribe(() => this.notify()); this.lifetime.activate(); }
  /** Call with the original loaded rows and the currently filtered original rows, plus the real action locks. */
  update(loaded: readonly QolipCheckoutEntry[], visible: readonly QolipCheckoutEntry[], locks: Locks) {
    if (!this.lifetime.canChoose()) return;
    const available = new Set(loaded);
    if (visible.some(entry => !available.has(entry))) return;
    this.loaded = [...loaded]; this.visible = [...visible];
    this.locks = { returningIds: new Set(locks.returningIds), bulkReturning: locks.bulkReturning };
    this.selected = qolipCheckoutSelection(this.loaded, this.selected).retained; this.publish();
  }
  private toggle(entry: QolipCheckoutEntry) {
    if (this.locks.bulkReturning || this.locks.returningIds.has(entry.id)) return false;
    if (this.selected.has(entry.id)) this.selected.delete(entry.id); else this.selected.add(entry.id);
    return true;
  }
  tap(entry: QolipCheckoutEntry) {
    if (!this.lifetime.canChoose() || !this.visible.includes(entry)) return;
    if (this.selected.size) { if (this.toggle(entry)) this.publish(); return; }
    this.expanded = this.expanded === entry.id ? null : entry.id; this.publish();
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
    return selected.length ? selected : null;
  }
  canChoose(): boolean { return this.lifetime.canChoose(); }
  suspend() { const stop = this.stopLifetime; this.stopLifetime = null; stop?.(); this.lifetime.suspend(); }
}
