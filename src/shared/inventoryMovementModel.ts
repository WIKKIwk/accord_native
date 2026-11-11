import type { Session } from '../auth';
import type { inventoryAssetFromJson, inventoryLocationFromJson, inventoryTransferFromJson } from '../inventoryModels';

export type MovementAsset = ReturnType<typeof inventoryAssetFromJson>;
export type MovementLocation = ReturnType<typeof inventoryLocationFromJson>;
export type MovementTransfer = ReturnType<typeof inventoryTransferFromJson>;
export type MovementTab = 'assets' | 'incoming' | 'outgoing';
export const movementAssetKey = (asset: MovementAsset) => `${asset.kind}:${asset.asset_ref.toLowerCase()}`;
export const movementAvailable = (asset: MovementAsset) => asset.status.trim().toLowerCase() === 'available' && !asset.transfer_id.trim();
const lower = (value: string) => value.trim().toLowerCase();
export const movementAssigned = (session: Session) => {
  const values = session.assigned_warehouses ?? session.profile.assigned_warehouses;
  return new Set((Array.isArray(values) ? values : []).filter((value): value is string => typeof value === 'string').map(lower).filter(Boolean));
};
let lastKeyMicros = 0;
export function movementIdempotencyKey(action: string) {
  lastKeyMicros = Math.max(Date.now() * 1000, lastKeyMicros + 1);
  return `mobile:${action}:${lastKeyMicros}`;
}
export const movementIsAdmin = (session: Session) => session.capabilities.includes('admin.access') || (session.profile.role === 'brigader' && session.capabilities.includes('brigader.access'));
/** @v2 _warehouseForLocations */
export function movementWarehouses(session: Session, locations: readonly MovementLocation[]) {
  const assigned = movementAssigned(session);
  return locations.filter(row => row.kind === 'warehouse' && row.active && (movementIsAdmin(session) || assigned.has(lower(row.name))));
}
/** @v2 _canBulkRelocate */
export function movementCanSelect(session: Session, asset: MovementAsset, warehouse: string, fromQr = false) {
  return movementAvailable(asset) && asset.physical_location.kind === 'warehouse' &&
    (movementIsAdmin(session) || asset.custody_warehouse_id === warehouse || (fromQr && movementAssigned(session).has(lower(asset.custody_warehouse))));
}
/** @v2 _filterTransfersByWarehouse */
export function movementFilterTransfers(rows: readonly MovementTransfer[], warehouseName: string, direction: 'incoming' | 'outgoing', query: string) {
  return rows.filter(row => lower(String(direction === 'incoming' ? row.destination_warehouse : row.source_warehouse)) === lower(warehouseName) &&
    (!query.trim() || [row.source_warehouse, row.destination_warehouse, row.note,
      ...row.lines.flatMap((line: Record<string, unknown>) => [line.item_name, line.item_code, line.identifier, line.asset_ref])]
      .some(value => String(value ?? '').toLowerCase().includes(lower(query)))));
}
/** @v2 _rawMaterialAssetBarcode */
export function movementBarcode(asset: MovementAsset) {
  if (asset.identifier.trim()) return asset.identifier.trim();
  const ref = asset.asset_ref.trim(), colon = ref.indexOf(':');
  return colon < 0 ? ref : ref.slice(colon + 1).trim();
}
/** @v2 rawMaterialBarcodeFromQr */
export function movementScanBarcode(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value);
    if (url.host) {
      for (const key of ['barcode', 'epc', 'qr']) { const code = url.searchParams.get(key)?.trim(); if (code) return code; }
      const last = url.pathname.split('/').pop(); if (last) return decodeURIComponent(last).trim();
    }
  } catch { /* Plain barcode. */ }
  return value;
}
export function movementQrMatches(rows: readonly MovementAsset[], barcode: string) {
  const warehouse = rows.filter(row => row.physical_location.kind === 'warehouse');
  const exact = warehouse.filter(row => [row.identifier, row.asset_ref, row.item_code].some(value => lower(value) === lower(barcode)));
  return exact.length ? exact : warehouse.length === 1 ? warehouse : [];
}
/** @v2 _statusLabel */
export function movementStatus(value: string) {
  const labels: Record<string, string> = { available: 'Mavjud', requested: 'So‘ralgan', approved: 'Tasdiqlangan', in_transit: 'Yo‘lda', received: 'Qabul qilingan', rejected: 'Rad etilgan', cancelled: 'Bekor qilingan', reserved: 'Band', transfer_reserved: 'Band' };
  return labels[value] ?? (value || '—');
}
/** @v2 _qty */
export const movementQuantity = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
/** @v2 _transferTimestamp */
export function movementTimestamp(transfer: MovementTransfer) {
  const date = new Date(transfer.created_at_unix * 1000), two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
