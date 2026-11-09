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

export type QolipGridCell = { label: string; letter: string; row: number; items: readonly QolipLocationEntry[];
  quantity: number; title: string; matchCount: number };
/** Row-major fixed grid; stats retain all locations, including labels outside the visible grid. */
export function qolipGridCells(locations: readonly QolipLocationEntry[], searchCounts: Readonly<Record<string, number>>) {
  const data = qolipGridData(locations);
  const rows = Array.from({ length: qolipGridRowCount }, (_, index) => {
    const row = index + 1;
    return qolipGridLetters.map(letter => {
      const label = `${letter}${row}`, items = data.byCell.get(label) ?? [];
      return { label, letter, row, items, quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        title: items[0]?.item_name ?? '', matchCount: searchCounts[label] ?? 0 };
    });
  });
  return { ...data, rows };
}

/** V2 overlays 22% #2E7D32 on the Material secondary container for search matches. */
export function qolipGridMatchBackground(secondaryContainer: string): string {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(secondaryContainer);
  if (!match) return secondaryContainer;
  const color = match[1], baseAlpha = match[2] ? parseInt(match[2], 16) / 255 : 1;
  const alpha = 0.22 + baseAlpha * 0.78;
  const background = [0, 2, 4].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  const green = [0x2e, 0x7d, 0x32];
  const channel = (index: number) => Math.round((green[index] * 0.22 + background[index] * baseAlpha * 0.78) / alpha)
    .toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`.toUpperCase();
}
