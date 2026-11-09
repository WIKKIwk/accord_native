import type { QolipBlock, QolipBlocksResult } from './qolipBlocksApi';
import { trimDart } from './qolipApiCommon';
import type { QolipLocationEntry } from './qolipLocationsApi';
import { filterQolipSearch, QolipSearchDocument } from './qolipSearchEngine';

export const qolipHomeBlockOrderKey = 'qolip.home.block_order';
export const qolipHomeBlockKey = (block: QolipBlock) => trimDart(block.name).toLowerCase();

/** @v2 reorderedTabIndex */
export function reorderedTabIndex(currentIndex: number, oldIndex: number, newIndex: number): number {
  if (currentIndex === oldIndex) return newIndex;
  if (oldIndex < currentIndex && currentIndex <= newIndex) return currentIndex - 1;
  if (newIndex <= currentIndex && currentIndex < oldIndex) return currentIndex + 1;
  return currentIndex;
}

/** @v2 _applySavedBlockOrder */
export function qolipApplySavedBlockOrder(blocks: readonly QolipBlock[], savedKeys: readonly string[]): QolipBlock[] {
  const remaining = new Map(blocks.map(block => [qolipHomeBlockKey(block), block]));
  const ordered: QolipBlock[] = [];
  for (const key of savedKeys) {
    const block = remaining.get(key);
    if (block) { ordered.push(block); remaining.delete(key); }
  }
  return [...ordered, ...remaining.values()];
}

/** @v2 _reorderBlocks */
export function qolipReorderBlocks(blocks: readonly QolipBlock[], selectedIndex: number, oldIndex: number, newIndex: number):
  { blocks: QolipBlock[]; selectedIndex: number; changed: boolean } {
  if (oldIndex < 0 || newIndex < 0 || oldIndex >= blocks.length || newIndex >= blocks.length || oldIndex === newIndex) {
    return { blocks: [...blocks], selectedIndex, changed: false };
  }
  const result = [...blocks], [moved] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, moved);
  return { blocks: result, selectedIndex: reorderedTabIndex(selectedIndex, oldIndex, newIndex), changed: true };
}

/** @v2 _sameHomeBlocks */
export function sameQolipHomeBlocks(a: QolipBlocksResult | null, b: QolipBlocksResult): boolean {
  return !!a && a.supports_cross_block_move === b.supports_cross_block_move && a.warehouses.length === b.warehouses.length &&
    a.blocks.length === b.blocks.length && a.warehouses.every((value, index) => value === b.warehouses[index]) &&
    a.blocks.every((block, index) => block.name === b.blocks[index].name && block.warehouse === b.blocks[index].warehouse);
}

/** @v2 _sameHomeLocations */
export function sameQolipHomeLocations(a: readonly QolipLocationEntry[] | null, b: readonly QolipLocationEntry[]): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((x, index) => {
    const y = b[index];
    return x.id === y.id && x.block === y.block && x.warehouse === y.warehouse && x.item_code === y.item_code &&
      x.item_name === y.item_name && x.qolip_code === y.qolip_code && x.size === y.size && x.quantity === y.quantity &&
      x.row_letter === y.row_letter && x.column_number === y.column_number && x.location_label === y.location_label;
  });
}

/** @v2 qolipLocationSearchDocument */
export function qolipLocationSearchDocument(item: QolipLocationEntry): QolipSearchDocument {
  return new QolipSearchDocument([item.item_name, item.item_code, item.qolip_code, String(item.size),
    item.block, item.warehouse, item.location_label]);
}

/** @v2 _loadBlockSearchMatches */
export async function qolipHomeSearchCounts(blocks: readonly QolipBlock[], query: string,
  locationsFor: (name: string) => Promise<readonly QolipLocationEntry[]>, isCurrent: () => boolean):
  Promise<{ blocks: Record<string, number>; cells: Record<string, Record<string, number>> } | null> {
  const entries = await Promise.all(blocks.map(async block => {
    try { return await locationsFor(block.name); } catch { return []; }
  }));
  if (!isCurrent()) return null;
  const matches = await filterQolipSearch(entries.flat(), query, qolipLocationSearchDocument, { isCurrent });
  if (!matches || !isCurrent()) return null;
  const blockCounts: Record<string, number> = Object.create(null), cellCounts: Record<string, Record<string, number>> = Object.create(null);
  for (const location of matches) {
    const block = trimDart(location.block).toLowerCase(), cell = trimDart(location.location_label).toUpperCase();
    blockCounts[block] = (blockCounts[block] ?? 0) + 1;
    const cells = cellCounts[block] ??= Object.create(null);
    cells[cell] = (cells[cell] ?? 0) + 1;
  }
  return { blocks: blockCounts, cells: cellCounts };
}
