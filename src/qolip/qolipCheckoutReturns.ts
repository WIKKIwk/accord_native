import type { QolipCheckoutEntry } from './qolipCheckoutApi';
import { qolipKnownReturnCell } from './qolipCheckoutLogic';
import { normalizeQolipCellLabel } from './qolipCellPickerLogic';
type Dependencies = {
  current(): boolean; pick(entry: QolipCheckoutEntry): Promise<string | null>;
  send(entry: QolipCheckoutEntry, cell: string): Promise<unknown>; reload(): Promise<void>;
  selected(): readonly QolipCheckoutEntry[] | null; replaceSelected(ids: ReadonlySet<string>): void;
  message(key: string, values?: Record<string, unknown>): void; failure(error: unknown): void;
};
/** @v2 QolipCheckoutsScreen: resolve every target before sending the source-ordered batch. */
export class QolipCheckoutReturns {
  private listeners = new Set<() => void>();
  private value = { returningIds: new Set<string>(), bulkReturning: false };
  constructor(private readonly deps: Dependencies) {}
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  getSnapshot = () => this.value;
  private publish(returningIds: Set<string>, bulkReturning = this.value.bulkReturning) {
    this.value = { returningIds, bulkReturning }; this.listeners.forEach(callback => callback());
  }
  private async target(entry: QolipCheckoutEntry) {
    if (!this.deps.current()) return null;
    const known = qolipKnownReturnCell(entry), raw = known ?? await this.deps.pick(entry);
    return this.deps.current() && raw !== null ? normalizeQolipCellLabel(raw) : null;
  }
  async single(entry: QolipCheckoutEntry) {
    if (!this.deps.current() || this.value.returningIds.has(entry.id)) return;
    const cell = await this.target(entry); if (!cell || !this.deps.current()) return;
    this.publish(new Set([...this.value.returningIds, entry.id]));
    try {
      await this.deps.send(entry, cell); if (!this.deps.current()) return;
      this.deps.message('checkouts.returned', { item: entry.item_name, cell }); await this.deps.reload();
    } catch (error) { if (this.deps.current()) this.deps.failure(error); }
    finally { if (this.deps.current()) { const ids = new Set(this.value.returningIds); ids.delete(entry.id); this.publish(ids); } }
  }
  async bulk() {
    if (!this.deps.current() || this.value.bulkReturning) return;
    const selected = this.deps.selected(); if (!selected?.length) return;
    const targets: { entry: QolipCheckoutEntry; cell: string }[] = [];
    for (const entry of selected) {
      const cell = await this.target(entry); if (!cell || !this.deps.current()) return;
      targets.push({ entry, cell });
    }
    this.publish(new Set([...this.value.returningIds, ...selected.map(entry => entry.id)]), true);
    const failed = new Set<string>(); let success = 0;
    for (const target of targets) {
      if (!this.deps.current()) return;
      try { await this.deps.send(target.entry, target.cell); success++; } catch { failed.add(target.entry.id); }
    }
    if (!this.deps.current()) return;
    const returning = new Set(this.value.returningIds); selected.forEach(entry => returning.delete(entry.id));
    this.publish(returning, false); this.deps.replaceSelected(failed);
    try { await this.deps.reload(); } catch { /* Read owner renders its source retry state. */ }
    if (this.deps.current()) this.deps.message(failed.size ? 'checkouts.selection_returned_partial' : 'checkouts.selection_returned',
      { count: success, success, failed: failed.size });
  }
}
