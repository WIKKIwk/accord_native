import { UsbRpsPrintRequest } from '../printing/printModels';
import type { RawMaterialReprint } from '../shared/printApi';
import { MobileApiException } from '../shared/mobileApiException';
import type { GScaleBatchSession, materialReceiptPrintResponseFromJson } from './gscaleBatchModel';

type Receipt = ReturnType<typeof materialReceiptPrintResponseFromJson>;

/** @v2 normalizePrinterChoice */
export function normalizePrinterChoice(value: string): 'godex' | 'zebra' {
  return ['godex', 'go-dex', 'g500'].includes(value.trim().toLowerCase()) ? 'godex' : 'zebra';
}
/** @v2 normalizeQuantitySource */
export function normalizeQuantitySource(value: string): 'manual' | 'scale' {
  return value.trim().toLowerCase() === 'manual' ? 'manual' : 'scale';
}
/** @v2 parsePositiveKg */
export function parsePositiveKg(value: string): number | null {
  const normalized = value.trim().replaceAll(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
/** @v2 parseScaleDisplayKg */
export function parseScaleDisplayKg(value: string): number | null {
  const match = /\d+(?:[,.]\d+)?/.exec(value.trim());
  return match ? parsePositiveKg(match[0]) : null;
}
/** @v2 canTriggerGrossPrint */
export function canTriggerGrossPrint(grossKg: number | null, babinaEnabled: boolean, babinaText: string): boolean {
  if (grossKg == null || grossKg <= 0) return false;
  const babinaKg = babinaEnabled ? parsePositiveKg(babinaText) : null;
  if (babinaEnabled && babinaKg == null) return false;
  const tare = babinaKg ?? 0;
  return grossKg > tare && grossKg - tare >= 0.100;
}
/** @v2 parseManualDuplicateCount */
export function parseManualDuplicateCount(value: string): number | null {
  const input = value.trim();
  if (!input) return 1;
  if (!/^[+-]?\d+$/.test(input)) return null;
  const count = Number(input);
  return count > 0 && count <= 100 ? count : null;
}
/** @v2 autoBatchPrintKey */
export function autoBatchPrintKey(grossKg: number | null, scaleStable: boolean, babinaEnabled: boolean, babinaText: string): string {
  return scaleStable && canTriggerGrossPrint(grossKg, babinaEnabled, babinaText) ? grossKg!.toFixed(3) : '';
}
/** @v2 shouldTriggerAutoBatchPrint */
export function shouldTriggerAutoBatchPrint(batchActive: boolean, loading: boolean, stablePrintKey: string, lastPrintedKey: string): boolean {
  return batchActive && !loading && !!stablePrintKey && stablePrintKey !== lastPrintedKey;
}
/** @v2 canPressScaleBatchAction */
export function canPressScaleBatchAction(hasPrintSelection: boolean, batchActive: boolean, manualPrintLoading: boolean, batchActionLoading: boolean): boolean {
  return !manualPrintLoading && !batchActionLoading && (batchActive || hasPrintSelection);
}
/** @v2 scaleBatchActionLabel */
export function scaleBatchActionLabel(loading: boolean, batchActive: boolean): string {
  return loading ? 'Kutilmoqda...' : batchActive ? 'To‘xtatish' : 'Boshlash';
}
/** @v2 hasExactRpsBatchContext */
export function hasExactRpsBatchContext(batch: GScaleBatchSession | null): boolean {
  return batch != null && !!batch.id.trim() && batch.revision > 0 && !!batch.item_code.trim() && !!batch.warehouse.trim();
}
/** @v2 hasCompleteRpsBatchPrintContext */
export function hasCompleteRpsBatchPrintContext(batch: GScaleBatchSession | null): boolean {
  return hasExactRpsBatchContext(batch) && batch?.length_m != null && Number.isFinite(batch.length_m) && batch.length_m > 0;
}
/** @v2 rpsBatchActionErrorMessage */
export function rpsBatchActionErrorMessage(error: unknown): string {
  if (!(error instanceof MobileApiException)) return String(error);
  switch (error.code) {
    case 'batch_context_conflict': return 'Batch boshqa joyda o‘zgargan. Eski mahsulot chop etilmadi; holatni yangilang.';
    case 'batch_store_failed': return 'Server batch holatini saqlay olmadi. Amal bekor qilindi; qayta urinishdan oldin holatni yangilang.';
    case 'batch_not_active': return 'Faol batch topilmadi. Holatni yangilab, yangi batch boshlang.';
    case 'submit_failed': case 'store_write_failed': return `ERPNext operatsiyani qabul qilmadi va batch xavfsizlik uchun to‘xtatildi: ${error.message}`;
    case 'print_failed': return `Printer chop etmadi: ${error.message}`;
    default: return error.message;
  }
}
/** @v2 buildPrintSuccessMessage */
export function buildPrintSuccessMessage(response: Receipt, serverLabel = ''): string {
  const qty = (response.net_qty > 0 ? response.net_qty : response.qty).toFixed(3).replace(/\.?0+$/, '');
  const target = serverLabel.trim() ? ` • ${serverLabel.trim()}` : '';
  const duplicates = response.print_count > 1 ? ` • ${response.print_count} ta` : '';
  return response.status.trim().toLowerCase() === 'printed'
    ? `Printerga yuborildi${target}${duplicates} • netto ${qty} ${response.unit}`
    : `${response.draft_name || 'draft'} submit qilindi${target}${duplicates} • netto ${qty} ${response.unit}`;
}
/** @v2 toUsbPrintRequest */
export function receiptToUsbPrintRequest(response: Receipt, labelKind = '', manufacturerName = ''): UsbRpsPrintRequest {
  const tareKg = Math.max(0, response.gross_qty - response.net_qty);
  return new UsbRpsPrintRequest({ epc: response.epc, itemCode: response.item_code, itemName: response.item_name,
    warehouse: response.warehouse, printer: 'godex', printMode: 'label', grossQty: response.gross_qty, unit: response.unit,
    tareEnabled: tareKg > 0, tareKg, printCount: response.print_count, labelKind, manufacturerName,
    progressQty: response.length_m, progressUnit: response.length_m == null ? '' : 'm' });
}
/** @v2 buildMaterialReceiptReprintRequest */
export function buildMaterialReceiptReprintRequest(prepared: RawMaterialReprint,
  history: { net_qty: number; qty: number; gross_qty: number; unit: string; print_mode: string }, printer: string): UsbRpsPrintRequest {
  const stock = prepared.stock;
  const length = stock.length_m != null && Number.isFinite(stock.length_m) && stock.length_m > 0 ? stock.length_m : null;
  const historyNet = history.net_qty > 0 ? history.net_qty : history.qty;
  const historyGross = history.gross_qty > 0 ? history.gross_qty : historyNet;
  const grossQty = Math.abs(historyNet - stock.qty) <= 0.000001 && historyGross >= stock.qty ? historyGross : stock.qty;
  const tare = Math.max(0, grossQty - stock.qty), normalized = normalizePrinterChoice(printer);
  return new UsbRpsPrintRequest({ epc: stock.barcode, itemCode: stock.item_code, itemName: stock.item_name.trim() || stock.item_code,
    warehouse: stock.warehouse, printer: normalized, printMode: normalized === 'godex' ? 'label' : history.print_mode.trim().toLowerCase() === 'label' ? 'label' : 'rfid',
    grossQty, unit: stock.uom.trim() || history.unit, tareEnabled: tare > 0, tareKg: tare, printCount: 1,
    labelKind: 'material_product', progressQty: length, progressUnit: length == null ? '' : 'm' });
}
