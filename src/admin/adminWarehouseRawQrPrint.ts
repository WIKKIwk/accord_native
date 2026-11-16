import { NativeUsbPrinter } from '../printing/nativePrinter';
import { UsbRpsPrintRequest } from '../printing/printModels';
import { ZebraRpsRenderer } from '../printing/zebraRpsRenderer';
import type { WorkerPrintJob } from '../workerPrintJob';
import { adminWarehouseItemRollsChecked } from './adminWarehouseItemRollsApi';

/** V2 Warehouse calls PrintService's default offline USB path, without a device picker. GoDEX is excluded by D13. */
export async function printAdminWarehouseRawQr(job: WorkerPrintJob, guard: () => void): Promise<boolean> {
  const check = adminWarehouseItemRollsChecked(guard);
  try {
    check(); const request = UsbRpsPrintRequest.fromPrintJson(job);
    if (request.isMaterialProductLabel && request.printCount > 1) throw new Error('Har bir homashyo uchun alohida EPC bilan print request yuborilishi kerak');
    const printer = await NativeUsbPrinter.detectPrinter(); check();
    if (printer.kind !== 'zebra') throw new Error('USB printer is not Zebra');
    const effective = request.forPrinter(printer), bytes = ZebraRpsRenderer.renderRepeated(effective); check();
    const result = await NativeUsbPrinter.printRaw(bytes, printer.kind, effective.printCount); check(); const ok = result.ok === true; check(); return ok;
  } catch (error) { check(); throw error; }
}
