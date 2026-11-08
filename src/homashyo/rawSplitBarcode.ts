import { preparationInventoryBarcode } from '../preparation/preparationInventory';
import { rawMaterialBarcodeFromQr } from '../shared/barcode/rawMaterialBarcode';

/** Reuse the existing parser only for opaque ASCII codes where both implementations agree. */
export function rawSplitBarcode(raw: string): string {
  if (/^[\t\n\v\f\r ]*[A-Za-z0-9 _./-]*[\t\n\v\f\r ]*$/.test(raw)) return preparationInventoryBarcode(raw);
  return rawMaterialBarcodeFromQr(raw);
}
