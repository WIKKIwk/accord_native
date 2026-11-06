import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { inventoryViewRuntimeFor } from '../shared/inventoryViewRuntime';
import type { InventoryViewStore } from '../shared/inventoryViewStore';
import { activeSessionToken } from '../auth';
import { inventoryAssets } from '../inventoryReadApi';
import type { inventoryAssetFromJson, inventoryLocationFromJson, inventoryTransferFromJson } from '../inventoryModels';
import { inventoryCreateTransfer } from './preparationInventoryTransfers';

export type PreparationInventoryAsset = ReturnType<typeof inventoryAssetFromJson>;
export type PreparationInventoryLocation = ReturnType<typeof inventoryLocationFromJson>;
export type PreparationInventoryTransfer = ReturnType<typeof inventoryTransferFromJson>;
const lower = (value: string) => value.trim().toLowerCase();

/** Reuse the shared inventory live windows for the preparation movements route. */
export function preparationInventoryStore(session: Session): InventoryViewStore {
  if (session.profile.role !== 'tayyorlov_masteri' || !canOpenRoute(session, appRoutes.inventoryMovements))
    throw new Error('Inventar ruxsatlari o‘zgardi. Hisobni yangilang.');
  return inventoryViewRuntimeFor(session);
}

export function preparationInventoryAssets(store: InventoryViewStore, warehouseId: string, query: string) {
  return store.assets({ warehouseId, query, assetKind: 'raw_material', includeOrderAssignment: true });
}

/** @v2 rawMaterialBarcodeFromQr */
export function preparationInventoryBarcode(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value);
    if (url.host) {
      for (const key of ['barcode', 'epc', 'qr']) {
        const candidate = url.searchParams.get(key)?.trim(); if (candidate) return candidate;
      }
      const last = url.pathname.split('/').pop();
      if (last) return decodeURIComponent(last).trim();
    }
  } catch { /* A plain code is not a URL. */ }
  return value;
}

/** @v2 _qrAssetMatchesBarcode */
export function preparationInventoryQrMatches(assets: readonly PreparationInventoryAsset[], barcode: string) {
  const value = barcode.trim().toLowerCase();
  const warehouse = assets.filter(asset => asset.physical_location.kind === 'warehouse');
  const exact = warehouse.filter(asset => [asset.identifier, asset.asset_ref, asset.item_code].some(item => item.trim().toLowerCase() === value));
  return exact.length ? exact : warehouse.length === 1 ? warehouse : [];
}

export function preparationInventoryAssetBarcode(asset: PreparationInventoryAsset): string {
  const identifier = asset.identifier.trim();
  if (identifier) return identifier;
  const ref = asset.asset_ref.trim(), separator = ref.indexOf(':');
  return separator < 0 ? ref : ref.slice(separator + 1).trim();
}

export async function lookupPreparationInventoryQr(session: Session, raw: string) {
  const barcode = preparationInventoryBarcode(raw);
  if (!barcode || !activeSessionToken(session)) return [];
  const rows = await inventoryAssets(session, { query: barcode, asset_kind: 'raw_material', limit: 100, include_order_assignment: true });
  if (!activeSessionToken(session)) return [];
  const matches = preparationInventoryQrMatches(rows, barcode);
  if (!matches.length) throw new Error('Bu QR bo‘yicha mahsulot topilmadi');
  return matches;
}

/** @v2 _showAssetDetails */
export function preparationInventoryCanTransfer(asset: PreparationInventoryAsset, assigned: readonly string[]) {
  const names = new Set(assigned.map(name => name.trim().toLowerCase()));
  return lower(asset.status) === 'available' && !asset.transfer_id.trim() && asset.physical_location.kind === 'warehouse' &&
    names.has(lower(asset.custody_warehouse));
}

/** @v2 _filterTransfersByWarehouse */
export function preparationInventoryTransfersFor(transfers: readonly PreparationInventoryTransfer[], warehouseName: string,
  direction: 'incoming' | 'outgoing', query: string) {
  const warehouse = lower(warehouseName), search = lower(query);
  return transfers.filter(transfer => {
    const location = direction === 'incoming' ? transfer.destination_warehouse : transfer.source_warehouse;
    if (warehouse && lower(String(location)) !== warehouse) return false;
    return !search || [transfer.source_warehouse, transfer.destination_warehouse, transfer.note,
      ...transfer.lines.flatMap((line: Record<string, unknown>) => [line.item_name, line.item_code, line.identifier, line.asset_ref])]
      .some(value => String(value ?? '').toLowerCase().includes(search));
  });
}

export function preparationInventoryIsInternalTransfer(asset: PreparationInventoryAsset, destination: PreparationInventoryLocation,
  assigned: readonly string[]) {
  const names = new Set(assigned.map(name => name.trim().toLowerCase()));
  return names.has(asset.custody_warehouse.trim().toLowerCase()) && names.has(destination.name.trim().toLowerCase());
}

export async function requestPreparationInventoryTransfer(session: Session, asset: PreparationInventoryAsset,
  destination: PreparationInventoryLocation, assigned: readonly string[]) {
  if (!activeSessionToken(session) || !preparationInventoryCanTransfer(asset, assigned) || !destination.active ||
      destination.kind !== 'warehouse' || destination.warehouse_id === asset.custody_warehouse_id)
    throw new Error('Manba, qabul qiluvchi va mahsulotni tanlang');
  return inventoryCreateTransfer(session, { sourceWarehouseId: asset.custody_warehouse_id,
    destinationWarehouseId: destination.warehouse_id, assets: [asset], idempotencyKey: `mobile:transfer:${Date.now() * 1000}` });
}
