import { preparationInventoryBarcode } from '../preparation/preparationInventory';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';

/** Reuse the existing native parser only when it agrees with the shared V2 candidate. */
export function rawSplitBarcode(raw: string): string {
  const expected = rawMaterialBarcodeFromQr(raw);
  const existing = preparationInventoryBarcode(raw);
  return existing === expected ? existing : expected;
}
