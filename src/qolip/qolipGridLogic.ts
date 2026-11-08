import { trimDart } from './qolipApiCommon';
import type { QolipLocationEntry } from './qolipLocationsApi';

export const qolipGridLetters = Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
export const qolipGridRowCount = 13;

/** @v2 _QolipBlockGrid */
export function qolipGridData(locations: readonly QolipLocationEntry[]): {
  byCell: Map<string, QolipLocationEntry[]>; unplaced: QolipLocationEntry[]; occupiedCells: number; totalQuantity: number;
} {
  const byCell = new Map<string, QolipLocationEntry[]>(), unplaced: QolipLocationEntry[] = [];
  let totalQuantity = 0;
  for (const location of locations) {
    const label = trimDart(location.location_label).toUpperCase();
    if (!label) unplaced.push(location);
    else {
      const cell = byCell.get(label) ?? [];
      cell.push(location); byCell.set(label, cell);
    }
    totalQuantity += location.quantity;
  }
  return { byCell, unplaced, occupiedCells: byCell.size, totalQuantity };
}

/** @v2 _openCellAction */
export function qolipCellAlternatives(cellLabel: string, locations: readonly QolipLocationEntry[]): {
  unplaced: QolipLocationEntry[]; movableIn: QolipLocationEntry[];
} {
  const target = trimDart(cellLabel).toUpperCase();
  return { unplaced: locations.filter(item => !trimDart(item.location_label)), movableIn: locations.filter(item => {
    const label = trimDart(item.location_label).toUpperCase();
    return !!label && label !== target;
  }) };
}

/** @v2 _openCellDetail */
export function qolipCellSelection(items: readonly QolipLocationEntry[], selectedIds: ReadonlySet<string>) {
  return { selectionMode: selectedIds.size > 0, selectedItems: items.filter(item => selectedIds.has(item.id)) };
}
