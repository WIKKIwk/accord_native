import type { AdminWarehouseMainState } from './adminWarehouseMainController';
import type { AdminWarehouseMainRow } from './AdminWarehouseMainRows';

export type AdminWarehouseMainEntry = { key: string; gap: number } & (
  | { kind: 'row'; row: AdminWarehouseMainRow; index: number; count: number }
  | { kind: 'loading'; small?: boolean }
  | { kind: 'retry'; more: boolean }
  | { kind: 'message' | 'hint'; textKey: string }
);
/** The source's mutually exclusive product branch, followed by raw stock and the paging footer. */
export function adminWarehouseMainEntries(state: AdminWarehouseMainState, qolip: boolean, available: readonly (readonly AdminWarehouseMainRow[])[], reserved: readonly (readonly AdminWarehouseMainRow[])[]): AdminWarehouseMainEntry[] {
  const entries: AdminWarehouseMainEntry[] = []; let block = 0;
  const append = (value: { kind: 'loading'; small?: boolean } | { kind: 'retry'; more: boolean } | { kind: 'message' | 'hint'; textKey: string }, top = 0) => { entries.push({ ...value, key: `block:${block}`, gap: (block++ ? 16 : 0) + top }); };
  const group = (rows: readonly AdminWarehouseMainRow[]) => {
    if (!rows.length) return; const gap = block++ ? 16 : 0;
    rows.forEach((row, index) => entries.push({ kind: 'row', row, index, count: rows.length, key: row.id, gap: index ? 2 : gap }));
  };
  if (!state.summary.sections.length) return [{ kind: 'message', key: 'empty', gap: 24, textKey: 'warehouse.empty' }];
  if (!state.warehouse) return [{ kind: 'message', key: 'unselected', gap: 24, textKey: 'warehouse.no_selection' }];
  if (state.stockTab === 'reserved') { for (const rows of reserved) group(rows); if (entries.length) { entries[0] = { ...entries[0], gap: entries[0].gap + 8 }; return entries; } return [{ kind: 'message', key: 'empty', gap: 24, textKey: 'warehouse.no_products' }]; }
  if (state.itemsLoading) append({ kind: 'loading' }, 28);
  else if (state.itemsError && !state.items.length) append({ kind: 'retry', more: false }, 16);
  else {
    const primary = available.find(rows => rows[0]?.kind === (qolip ? 'qolip' : 'item'));
    if (primary?.length) group(primary);
    else if (qolip || !available.some(rows => rows[0]?.kind === 'raw')) append({ kind: 'message', textKey: qolip ? 'warehouse.no_mold_products' : 'warehouse.no_products' }, 16);
  }
  for (const rows of available) if (rows[0]?.kind === 'raw') group(rows);
  if (state.loadingMore) append({ kind: 'loading', small: true }, 14);
  else if (state.itemsError && state.items.length) append({ kind: 'retry', more: true }, 12);
  else if (state.hasMore) append({ kind: 'hint', textKey: 'warehouse.load_more_hint' }, 12);
  if (entries.length) entries[0] = { ...entries[0], gap: entries[0].gap + 8 };
  return entries;
}
