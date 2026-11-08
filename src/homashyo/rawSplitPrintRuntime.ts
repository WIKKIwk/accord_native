import type { Session } from '../auth';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { PrintService } from '../printing/printService';
import { rawSplitPrint } from './rawSplitApi';
import type { RawSplitResult, RawSplitRoll } from './rawSplitModel';
import { rawMaterialSplitPrintRequest } from './rawSplitPrinting';

export class RawSplitUnsupportedPrinter extends Error {}
/** GoDEX is excluded by D13. Check this before saving stock, not after committing it. */
export function rawSplitPrinterSupported(device: PreparationDeviceSelection, wifiPrinter: string): boolean {
  if (device.transport === 'bluetooth') return true;
  if (device.transport === 'offline') return device.printer.kind === 'zebra';
  return wifiPrinter === 'zebra' && !!device.driverBaseUrl;
}

/** Print one existing child roll through the existing native bridge or V2 Wi-Fi API. */
export async function printRawSplitRoll(session: Session, result: RawSplitResult, output: RawSplitRoll,
  device: PreparationDeviceSelection, wifiPrinter: string, guard: () => void): Promise<void> {
  guard();
  if (!rawSplitPrinterSupported(device, wifiPrinter)) throw new RawSplitUnsupportedPrinter();
  if (device.transport === 'wifi') {
    await rawSplitPrint(session, { splitId: result.id, barcode: output.barcode, driverUrl: device.driverBaseUrl!,
      printer: wifiPrinter, printMode: 'label' });
    return;
  }
  const request = rawMaterialSplitPrintRequest(output);
  const response = await PrintService.printRps(request, device.transport === 'offline'
    ? { transport: 'offline', printerProfile: device.printer }
    : { transport: 'bluetooth', bluetoothPrinter: device.printer });
  if (!response.ok || response.status !== 'done') throw new Error('Printer natijani tasdiqlamadi');
}

/** V2 prints each output once, in returned order, with scope checked before each. */
export async function printRawSplitResult(session: Session, result: RawSplitResult, device: PreparationDeviceSelection,
  wifiPrinter: string, guard: () => void): Promise<void> {
  for (const output of result.outputs) await printRawSplitRoll(session, result, output, device, wifiPrinter, guard);
}
