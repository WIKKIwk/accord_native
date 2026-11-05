import { BluetoothPrinterProfile, NativeBluetoothPrinter, NativeUsbPrinter } from './nativePrinter';
import { type PrintTransport } from './printTransport';
import { UsbPrinterProfile, UsbRpsPrintRequest, UsbRpsPrintResponse } from './printModels';
import { SessionBluetoothPrinter } from './sessionBluetoothPrinter';
import { ZebraRpsRenderer } from './zebraRpsRenderer';

type PrintOptions = {
  printerProfile?: UsbPrinterProfile | null;
  bluetoothPrinter?: BluetoothPrinterProfile | null;
  transport?: PrintTransport;
};

/** @v2 PrintService */
export class PrintService {
  static async printRps(request: UsbRpsPrintRequest, options: PrintOptions = {}): Promise<UsbRpsPrintResponse> {
    if (request.isMaterialProductLabel && request.printCount > 1) {
      throw new Error('Har bir homashyo uchun alohida EPC bilan print request yuborilishi kerak');
    }
    if (options.transport === 'bluetooth') {
      const printer = options.bluetoothPrinter;
      if (!printer) throw new Error('XP-P323B Bluetooth printer tanlanmagan');
      const effective = new UsbRpsPrintRequest({ ...request, printer: printer.printer, printMode: printer.printMode });
      let result: Record<string, unknown>;
      try { result = await NativeBluetoothPrinter.printLabel(effective, printer); }
      catch (error) { SessionBluetoothPrinter.forgetIfMatches(printer.address); throw error; }
      return UsbRpsPrintResponse.fromMap({ ...effective.toJson(), ...result, status: result.status ?? 'done',
        ok: result.ok === true, mode: effective.printMode, net_qty: effective.netQty, gross_qty: effective.grossQty,
        printer_status: result.printer_status ?? 'Bluetooth OK', print_count: effective.printCount, bytes: result.bytes ?? 0 });
    }
    const profile = options.printerProfile ?? await NativeUsbPrinter.detectPrinter();
    if (profile.kind !== 'zebra') throw new Error('USB printer is not Zebra');
    const effective = request.forPrinter(profile);
    const bytes = ZebraRpsRenderer.renderRepeated(effective);
    const result = await NativeUsbPrinter.printRaw(bytes, profile.kind, effective.printCount);
    return UsbRpsPrintResponse.fromMap({ ...effective.toJson(), ...result, status: result.status ?? 'done',
      ok: result.ok === true, mode: effective.printMode, net_qty: effective.netQty, gross_qty: effective.grossQty,
      printer_status: result.printer_status ?? 'USB OK', print_count: effective.printCount, bytes: result.bytes ?? bytes.length });
  }
  static detectOfflinePrinter(): Promise<UsbPrinterProfile> { return NativeUsbPrinter.detectPrinter(); }
  static printRpsTest(request: UsbRpsPrintRequest): Promise<UsbRpsPrintResponse> { return this.printRps(request); }
}
