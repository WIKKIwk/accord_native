import type { inventoryAssetFromJson, inventoryLocationFromJson, inventoryTransferFromJson } from '../inventoryModels';

export type PreparationInventoryAsset = ReturnType<typeof inventoryAssetFromJson>;
export type PreparationInventoryLocation = ReturnType<typeof inventoryLocationFromJson>;
export type PreparationInventoryTransfer = ReturnType<typeof inventoryTransferFromJson>;
const lower = (value: string) => value.trim().toLowerCase();

/** @v2 rawMaterialBarcodeFromQr */
export function preparationInventoryBarcode(raw: string): string {
  const value = raw.trim();
  try {
    const uri = new URL(value);
    if (uri.protocol && uri.host) {
      for (const key of ['barcode', 'epc', 'qr']) {
        const candidate = uri.searchParams.get(key)?.trim();
        if (candidate) return candidate;
      }
      const last = uri.pathname.split('/').filter(Boolean).pop();
      if (last) return decodeURIComponent(last).trim();
    }
  } catch { /* Material identifiers are opaque text. */ }
  return value;
}

export function preparationInventoryAssetBarcode(asset: PreparationInventoryAsset): string {
  const identifier = asset.identifier.trim();
  if (identifier) return identifier;
  const ref = asset.asset_ref.trim(), separator = ref.indexOf(':');
  return separator < 0 ? ref : ref.slice(separator + 1).trim();
}

/** @v2 _qrAssetMatchesBarcode */
export function preparationInventoryQrMatches(assets: readonly PreparationInventoryAsset[], barcode: string) {
  const warehouse = assets.filter(asset => asset.physical_location.kind === 'warehouse');
  const matches = warehouse.filter(asset => [asset.identifier, asset.asset_ref, asset.item_code].some(value => lower(value) === lower(barcode)));
  return matches.length ? matches : warehouse.length === 1 ? warehouse : [];
}

/** @v2 _showAssetDetails */
export function preparationCanTransfer(asset: PreparationInventoryAsset, assignedWarehouses: readonly string[]): boolean {
  return lower(asset.status) === 'available' && !asset.transfer_id.trim() && asset.physical_location.kind === 'warehouse' &&
    assignedWarehouses.some(name => lower(name) === lower(asset.custody_warehouse));
}

/** @v2 _filterTransfersByWarehouse */
export function preparationInventoryTransfersFor( transfers: readonly PreparationInventoryTransfer[], warehouseName: string,
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
