import type { AdminRawMaterialAssignment } from './workerRawMaterials';
export type MaterialRow = Partial<AdminRawMaterialAssignment> & { material_name?: string };
export type WorkerMaterialListProps = { rows: MaterialRow[]; scanned: string[]; orderId?: string; onLongPress: (row: MaterialRow) => void; showBalances?: boolean };

/** @v2 _ScannedItemsExpansionHeader */
export function materialSectionExpansion({ loading, error, count, expanded }: {
  loading: boolean; error: string; count: number; expanded: boolean;
}) {
  const hasContent = loading || !!error.trim() || count > 0;
  return { hasContent, canToggle: hasContent && !loading, expanded: hasContent && expanded };
}

/** @v2 _materialAssignmentConfirmed */
export function materialAssignmentConfirmed(row: MaterialRow, scanned: string[], orderId: string) {
  const barcode = row.barcode?.trim().toUpperCase();
  if (!barcode) return false;
  if (scanned.some(code => code.trim().toUpperCase() === barcode)) return true;
  return !!orderId.trim() && row.reserved_order_id?.trim() === orderId.trim() &&
    ['in_use', 'consumed'].includes(row.stock_status?.trim().toLowerCase() ?? '');
}
/** @v2 _rawMaterialBalances */
export function rawMaterialBalances(assignments: MaterialRow[]) {
  const balances = new Map<string, { uom: string; received: number; consumed: number; remaining: number }>();
  for (const assignment of assignments) {
    const uom = assignment.stock_uom?.trim();
    if (!uom) continue;
    const key = uom.toLowerCase(), balance = balances.get(key) ?? { uom, received: 0, consumed: 0, remaining: 0 };
    for (const [field, property] of [['received_qty', 'received'], ['consumed_qty', 'consumed']] as const) {
      const value = assignment[field];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) balance[property] += value;
    }
    balance.remaining = Math.max(0, balance.received - balance.consumed); balances.set(key, balance);
  }
  return [...balances.values()].sort((a, b) => a.uom.toLowerCase() < b.uom.toLowerCase() ? -1 : a.uom.toLowerCase() > b.uom.toLowerCase() ? 1 : 0);
}
const statuses: Record<string, string> = {
  needs_cutting: 'Biriktirilgan — apparatingizga katta, rezka kerak', width_mismatch: 'Biriktirilgan — rulon eni orderga kichik',
  dimensions_missing: 'Biriktirilgan — rulon o‘lchamlari yetishmaydi', awaiting_delivery: 'Mos — apparat oldiga yetkazish kutilmoqda',
  ready: 'Mos — apparat oldida, qabul qilishga tayyor', in_use: 'Ishlatilmoqda', consumed: 'Ishlatilgan', unavailable: 'Biriktirilgan — hozir qabul qilib bo‘lmaydi',
};
/** @v2 _AssignedMaterialTile */
export function assignedMaterialPresentation(row: MaterialRow, scanned: string[], translate: (value: string) => string, orderId = '') {
  const title = String(row.item_name || row.material_name || row.item_code || '').trim();
  const details: string[] = [];
  const add = (raw?: string) => { const value = raw?.trim(); if (value && !details.some(item => item.toLowerCase() === value.toLowerCase())) details.push(value); };
  const itemCode = row.item_code?.trim() ?? '';
  if (itemCode && itemCode.toLowerCase() !== title.toLowerCase()) {
    const remainder = title && itemCode.toLowerCase().startsWith(title.toLowerCase()) ? itemCode.slice(title.length).trim() : itemCode;
    add(remainder.replace(/^[•·|,/-]+\s*/, ''));
  }
  add(row.item_group); add(row.barcode); add(statuses[row.execution_status ?? ''] ? translate(statuses[row.execution_status!]) : '');
  const primary = title || details.shift() || '';
  return { title: primary, details, subtitle: details.join(' • '), confirmed: materialAssignmentConfirmed(row, scanned, orderId) };
}
