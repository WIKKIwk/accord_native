import { offlineUsbDriverUrl, type PrintTransport } from '../printing/printTransport';
import type { BluetoothPrinterProfile } from '../printing/nativePrinter';
import type { UsbPrinterProfile, UsbRpsPrintRequest } from '../printing/printModels';
import { driverUrlForRs, type DiscoveredServer } from './gscaleDiscovery';
import { hasCompleteRpsBatchPrintContext, receiptToUsbPrintRequest } from './gscaleControlLogic';
import type { GScaleBatchPrint, GScaleBatchSession, materialReceiptPrintResponseFromJson } from './gscaleBatchModel';

type Receipt = ReturnType<typeof materialReceiptPrintResponseFromJson>;
export type GScalePrintDependencies = {
  printRemote(request: GScaleBatchPrint): Promise<Receipt>;
  prepare(request: GScaleBatchPrint): Promise<Receipt>;
  printLocal(request: UsbRpsPrintRequest, options: { transport: PrintTransport; printerProfile: UsbPrinterProfile | null;
    bluetoothPrinter: BluetoothPrinterProfile | null }): Promise<{ ok: boolean }>;
  confirm(request: GScaleBatchPrint, epc: string): Promise<Receipt>;
  refreshBatch(): Promise<unknown>;
};
export type GScalePrintContext = {
  preparationConflict: string; transport: PrintTransport; server: DiscoveredServer | null;
  batchResolved: boolean; batch: GScaleBatchSession | null; linkedOrderId: string;
  grossQtyKg: number; printCount?: number; materialSupplier?: string; isMaterialReceipt: boolean;
  offlinePrinter: UsbPrinterProfile | null; bluetoothPrinter: BluetoothPrinterProfile | null;
};
async function timed<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out')), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** @v2 _printActiveRsBatch */
export async function printActiveGScaleBatch(context: GScalePrintContext, api: GScalePrintDependencies): Promise<Receipt> {
  if (context.preparationConflict) throw new Error(context.preparationConflict);
  if (context.transport === 'wifi' && !context.server) throw new Error('Avval printer yoki tarozini tanlang');
  const batch = context.batch;
  if (!context.batchResolved || !batch || !batch.active) throw new Error('Faol batch holati server tomonidan tasdiqlanmagan');
  if (!hasCompleteRpsBatchPrintContext(batch)) throw new Error('Faol batch konteksti to‘liq emas');
  if (context.linkedOrderId.trim() && batch.order_id !== context.linkedOrderId.trim()) {
    throw new Error('Faol batch boshqa orderga tegishli. Batchni tugatib, tanlangan order bilan qayta boshlang');
  }
  const tare = batch.tare_enabled ? batch.tare_kg : 0;
  if (context.grossQtyKg <= 0 || context.grossQtyKg - tare < 0.100) throw new Error('Netto kg juda kichik');
  const local = context.transport !== 'wifi', count = context.printCount ?? 1;
  const request: GScaleBatchPrint = { batch_id: batch.id, expected_revision: batch.revision,
    expected_item_code: batch.item_code, expected_warehouse: batch.warehouse, gross_qty: context.grossQtyKg,
    driver_url: local ? offlineUsbDriverUrl : driverUrlForRs(context.server!), unit: 'kg', print_count: count };
  try {
    if (!local) return await timed(api.printRemote(request), 15000);
    const single = { ...request, print_count: 1 };
    let last: Receipt | null = null, completed = 0;
    for (let index = 0; index < count; index++) {
      try {
        const prepared = await timed(api.prepare(single), 15000);
        const print = await api.printLocal(receiptToUsbPrintRequest(prepared, 'material_product',
          context.isMaterialReceipt ? context.materialSupplier ?? '' : ''), { transport: context.transport,
          printerProfile: context.offlinePrinter, bluetoothPrinter: context.bluetoothPrinter });
        if (!print.ok) throw new Error('Printer QR kodini chop etmadi');
        last = await timed(api.confirm(single, prepared.epc), 15000);
        completed++;
      } catch (error) {
        if (!completed) throw error;
        throw new Error(`${completed}/${count} ta mahsulot chop etildi; keyingi print to‘xtadi: ${String(error)}`);
      }
    }
    if (!last) throw new Error('No labels printed');
    return { ...last, print_count: count };
  } finally { void api.refreshBatch().catch(() => {}); }
}
