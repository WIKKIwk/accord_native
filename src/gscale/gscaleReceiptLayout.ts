import type { GScaleRow } from './gscaleScreenModel';

export type ReceiptGroup = { kind: 'row' | 'fields' | 'actions' | 'summary'; rows: GScaleRow[] };

/** Arrange the existing controls without replacing their values, locks or handlers. */
export function gscaleReceiptGroups(rows: readonly GScaleRow[]): ReceiptGroup[] {
  const groups: ReceiptGroup[] = [];
  const summaryEnd = rows.findIndex(row => row.kind === 'action' && row.id === 'gscale-context-edit');
  let index = 0;
  if (summaryEnd >= 0) {
    groups.push({ kind: 'summary', rows: rows.slice(0, summaryEnd + 1) });
    index = summaryEnd + 1;
  }
  for (; index < rows.length; index++) {
    const row = rows[index], next = rows[index + 1];
    if (row.kind === 'field' && next?.kind === 'field' &&
        ((row.key === 'width_text' && next.key === 'micron_text') ||
         (row.key === 'manual_qty_text' && next.key === 'manual_duplicate_text'))) {
      groups.push({ kind: 'fields', rows: [row, next] }); index++;
    } else if (row.kind === 'action' && row.id === 'gscale-print' && next?.kind === 'action' && next.id === 'gscale-stop') {
      groups.push({ kind: 'actions', rows: [row, next] }); index++;
    } else groups.push({ kind: 'row', rows: [row] });
  }
  return groups;
}
