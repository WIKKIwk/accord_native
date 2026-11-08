import { trimDart } from './qolipApiCommon';
import { qolipCellSelection } from './qolipGridLogic';
import type { QolipHomeReadBoundary } from './qolipHomeBlockReadState';
import { QolipLocationChoiceLifetime } from './qolipLocationChoiceLifetime';
import type { QolipLocationEntry } from './qolipLocationsApi';

export type QolipCellDetailOptions = {
  cellLabel: string;
  items: readonly QolipLocationEntry[];
  unplaced: readonly QolipLocationEntry[];
  movableIn: readonly QolipLocationEntry[];
};
export type QolipCellDetailChoice = { kind: 'add' | 'place-unplaced' | 'move-in' }
  | { kind: 'take' | 'move-out'; item: QolipLocationEntry }
  | { kind: 'bulk-move'; items: readonly QolipLocationEntry[] };
type Snapshot = {
  invalid: boolean;
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  selectedItems: readonly QolipLocationEntry[];
  rows: readonly { item: QolipLocationEntry; selected: boolean; showActions: boolean; actionsEnabled: boolean }[];
  header: { kind: 'cell'; label: string } | { kind: 'selection'; count: number };
  unplacedCount: number;
  movableInCount: number;
  footerEnabled: boolean;
};
const invalidSnapshot: Snapshot = { invalid: true, selectionMode: false, selectedIds: new Set(), selectedItems: [], rows: [],
  header: { kind: 'cell', label: '' }, unplacedCount: 0, movableInCount: 0, footerEnabled: false };

/** Source row text differs from the location picker: do not omit an empty mold code or add a location suffix. */
export function qolipCellDetailRowLabel(item: QolipLocationEntry, quantityText: string) {
  return { title: trimDart(item.item_name) ? item.item_name : item.qolip_code,
    subtitle: `${item.qolip_code} • ${item.size} • ${quantityText}` };
}

/** Source-backed selection/presentation/choice protocol only; no sheet opener or mutation dispatcher. */
export class QolipCellDetailState {
  readonly items: readonly QolipLocationEntry[];
  readonly unplaced: readonly QolipLocationEntry[];
  readonly movableIn: readonly QolipLocationEntry[];
  private readonly lifetime: QolipLocationChoiceLifetime;
  private readonly listeners = new Set<() => void>();
  private stopLifetime: (() => void) | null = null;
  private value: Snapshot;
  constructor(private readonly options: QolipCellDetailOptions, boundary: QolipHomeReadBoundary) {
    this.items = [...options.items]; this.unplaced = [...options.unplaced]; this.movableIn = [...options.movableIn];
    this.lifetime = new QolipLocationChoiceLifetime(boundary); this.value = this.project(new Set());
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = (): Snapshot => this.lifetime.getSnapshot() ? this.value : invalidSnapshot;
  private notify() { for (const listener of [...this.listeners]) listener(); }
  private project(selectedIds: ReadonlySet<string>): Snapshot {
    const { selectionMode, selectedItems } = qolipCellSelection(this.items, selectedIds);
    return { invalid: false, selectionMode, selectedIds, selectedItems,
      rows: this.items.map(item => ({ item, selected: selectedIds.has(item.id), showActions: !selectedIds.has(item.id), actionsEnabled: !selectionMode })),
      header: selectionMode ? { kind: 'selection', count: selectedItems.length } : { kind: 'cell', label: this.options.cellLabel },
      unplacedCount: this.unplaced.length, movableInCount: this.movableIn.length, footerEnabled: !selectionMode };
  }
  activate() {
    this.stopLifetime ??= this.lifetime.subscribe(() => this.notify());
    this.lifetime.activate();
  }
  toggle(item: QolipLocationEntry) {
    if (!this.lifetime.canChoose() || !this.items.includes(item)) return;
    const selected = new Set(this.value.selectedIds);
    if (selected.has(item.id)) selected.delete(item.id); else selected.add(item.id);
    this.value = this.project(selected); this.notify();
  }
  tap(item: QolipLocationEntry) { if (this.value.selectionMode) this.toggle(item); }
  itemChoice(kind: 'take' | 'move-out', item: QolipLocationEntry): QolipCellDetailChoice | null {
    if ((kind !== 'take' && kind !== 'move-out') || !this.lifetime.canChoose() || this.value.selectionMode || !this.items.includes(item)) return null;
    return { kind, item };
  }
  footerChoice(kind: 'add' | 'place-unplaced' | 'move-in'): QolipCellDetailChoice | null {
    if (!['add', 'place-unplaced', 'move-in'].includes(kind) || !this.lifetime.canChoose() || this.value.selectionMode ||
        (kind === 'place-unplaced' && !this.unplaced.length) || (kind === 'move-in' && !this.movableIn.length)) return null;
    return { kind };
  }
  bulkChoice(): QolipCellDetailChoice | null {
    if (!this.lifetime.canChoose() || !this.value.selectionMode) return null;
    return { kind: 'bulk-move', items: this.value.selectedItems };
  }
  canChoose(): boolean { return this.lifetime.canChoose(); }
  suspend() {
    const stop = this.stopLifetime; this.stopLifetime = null; stop?.(); this.lifetime.suspend();
  }
}
