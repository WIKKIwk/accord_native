import { UsbRpsPrintRequest } from '../printing/printModels';
import { RawSplitRoll } from './rawSplitModel';
/** @v2 rawMaterialSplitPrintRequest */
export function rawMaterialSplitPrintRequest(output: RawSplitRoll): UsbRpsPrintRequest {
  return new UsbRpsPrintRequest({ epc: output.barcode, itemCode: output.itemCode, itemName: output.labelName,
    warehouse: output.warehouse, printer: 'godex', printMode: 'label', grossQty: Number(output.grossKg ?? output.kg),
    tareEnabled: output.grossKg !== null, tareKg: Number(output.bobinaKg ?? '0'), unit: 'kg', labelKind: 'material_product',
    progressQty: output.lengthM === null || !output.lengthM.trim() ? null : Number(output.lengthM), progressUnit: 'm' });
}
