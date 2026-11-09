import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import type { QolipCheckoutReadSnapshot } from './qolipCheckoutReadState';
import { QolipCheckoutReadState } from './qolipCheckoutReadState';
import { QolipCheckoutSelectionState, type QolipCheckoutLocks, type QolipCheckoutSelectionSnapshot } from './qolipCheckoutSelectionState';

export type QolipCheckoutViewActions = {
  setSearch: (value: string) => void;
  tap: (entry: QolipCheckoutEntry, renderedSelectionMode: boolean, renderedExpanded: boolean) => void;
  longPress: (entry: QolipCheckoutEntry) => void;
  cancelSelection: () => void;
};
export type QolipCheckoutViewSnapshot = {
  invalid: boolean;
  read: QolipCheckoutReadSnapshot | null;
  selection: QolipCheckoutSelectionSnapshot | null;
  actions: QolipCheckoutViewActions | null;
};
const invalid: QolipCheckoutViewSnapshot = Object.freeze({ invalid: true, read: null, selection: null, actions: null });
type Run = { active: boolean; stopRead: (() => void) | null; stopSelection: (() => void) | null;
  unsubscribeRead: (() => void) | null; unsubscribeSelection: (() => void) | null; actions: QolipCheckoutViewActions };
function absorbThenable(value: unknown) {
  try {
    if (value && (typeof value === 'object' || typeof value === 'function') &&
        typeof (value as { then?: unknown }).then === 'function') void Promise.resolve(value).catch(() => {});
  } catch { /* A stopped owner stays stopped. */ }
}

/** Unrouted read/selection composition. No return, bulk-return, retry or mutation callback is exposed. */
export class QolipCheckoutViewState {
  private readonly listeners = new Set<() => void>();
  private run: Run | null = null;
  private expired = false;
  private locks: QolipCheckoutLocks;
  private value: QolipCheckoutViewSnapshot = invalid;
  constructor(private readonly readOwner: QolipCheckoutReadState, private readonly selectionOwner: QolipCheckoutSelectionState,
    locks: QolipCheckoutLocks) {
    this.locks = { returningIds: new Set(locks.returningIds), bulkReturning: locks.bulkReturning };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): QolipCheckoutViewSnapshot => {
    const run = this.run;
    if (this.expired || !run?.active) return invalid;
    const read = this.readOwner.getSnapshot(), selection = this.selectionOwner.getSnapshot();
    if (this.expired || this.run !== run || !run.active || read.invalid || selection.invalid ||
        this.readOwner.getSnapshot().invalid || this.selectionOwner.getSnapshot().invalid) return invalid;
    if (this.expired || this.run !== run || !run.active) return invalid;
    if (this.value.invalid || this.value.read !== read || this.value.selection !== selection || this.value.actions !== run.actions) {
      this.value = { invalid: false, read, selection, actions: run.actions };
    }
    return this.value;
  };
  private notify() { for (const listener of [...this.listeners]) {
    try { const result: unknown = listener(); absorbThenable(result); } catch { /* Other observers still invalidate. */ }
  } }
  private current(run: Run): boolean {
    if (this.expired || this.run !== run || !run.active) return false;
    if (this.readOwner.getSnapshot().invalid || this.selectionOwner.getSnapshot().invalid ||
        this.expired || this.run !== run || !run.active || this.readOwner.getSnapshot().invalid || this.selectionOwner.getSnapshot().invalid) {
      this.invalidate(); return false;
    }
    if (this.expired || this.run !== run || !run.active) return false;
    return true;
  }
  private close(run: Run) {
    run.active = false;
    const stops = [run.unsubscribeRead, run.unsubscribeSelection, run.stopRead, run.stopSelection];
    run.unsubscribeRead = null; run.unsubscribeSelection = null; run.stopRead = null; run.stopSelection = null;
    for (const stop of stops) { try { const result: unknown = stop?.(); absorbThenable(result); } catch { /* Continue closing. */ } }
  }
  private invalidate() {
    if (this.expired) return;
    this.expired = true; if (this.run) this.close(this.run); this.value = invalid; this.notify();
  }
  private syncRead(run: Run) {
    if (!this.current(run)) return;
    const read = this.readOwner.getSnapshot();
    // FutureBuilder replaces the list widget with loading/error/empty states, losing its local expansion.
    const listMounted = !read.error && read.entries !== null && read.visible.length > 0;
    if (!this.selectionOwner.syncPresentation(read.visible, this.locks, listMounted)) { this.invalidate(); return; }
    if (this.current(run)) { this.getSnapshot(); this.notify(); }
  }
  private selectionChanged(run: Run) {
    if (this.current(run)) { this.getSnapshot(); this.notify(); }
  }
  activate(): () => void {
    if (this.run?.active) return () => {};
    const run = { active: true, stopRead: null, stopSelection: null, unsubscribeRead: null, unsubscribeSelection: null } as Run;
    const current = () => this.current(run);
    run.actions = Object.freeze({
      setSearch: value => { if (current()) this.readOwner.setSearch(value); },
      tap: (entry, renderedSelectionMode, renderedExpanded) => {
        if (current()) this.selectionOwner.tapRendered(entry, renderedSelectionMode, renderedExpanded);
      },
      longPress: entry => { if (current()) this.selectionOwner.longPress(entry); },
      cancelSelection: () => { if (current()) this.selectionOwner.cancel(); },
    });
    this.run = run;
    const suspend = () => { if (this.run !== run || !run.active) return; this.close(run); this.value = invalid; this.notify(); };
    run.unsubscribeRead = this.readOwner.subscribe(() => this.syncRead(run));
    run.unsubscribeSelection = this.selectionOwner.subscribe(() => this.selectionChanged(run));
    run.stopSelection = () => this.selectionOwner.suspend();
    this.selectionOwner.activate();
    // A suspended read owner is intentionally invalid until its new effect run activates.
    if (this.run !== run || !run.active || this.expired || this.selectionOwner.getSnapshot().invalid) {
      this.invalidate(); return suspend;
    }
    const stopRead = this.readOwner.activate();
    if (!current()) { try { stopRead(); } catch {} return suspend; }
    run.stopRead = stopRead;
    this.syncRead(run);
    return suspend;
  }
  /** Only the actual owner of return operations may provide these states; this method performs no action. */
  updateLocks(locks: QolipCheckoutLocks) {
    const run = this.run;
    if (!run || !this.current(run)) return;
    this.locks = { returningIds: new Set(locks.returningIds), bulkReturning: locks.bulkReturning };
    this.syncRead(run);
  }
}
