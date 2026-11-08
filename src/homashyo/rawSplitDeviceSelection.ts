import { driverUrlForRs, type DiscoveredServer } from '../gscale/gscaleDiscovery';
import type { PrintDeviceSelection } from '../gscale/gscalePreferences';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { RawSplitUnsupportedPrinter, rawSplitPrinterSupported } from './rawSplitPrintRuntime';

/** Carry the entire V2 server handshake; driver routing depends on server_ref and server_name. */
export type RawSplitDeviceSelection = PreparationDeviceSelection | (Extract<PreparationDeviceSelection, { transport: 'wifi' }> & { server: DiscoveredServer });

/** Convert the shared native picker's ephemeral result without saving or restoring any device. */
export function rawSplitDeviceSelection(selection: PrintDeviceSelection): RawSplitDeviceSelection {
  if (selection.transport === 'wifi') return { transport: 'wifi', server: selection.server,
    serverBaseUrl: selection.server.endpoint.baseUrl, driverBaseUrl: driverUrlForRs(selection.server) };
  if (selection.transport === 'bluetooth') return { transport: 'bluetooth', printer: selection.bluetoothPrinter };
  return { transport: 'offline', printer: selection.offlinePrinter };
}

/** D13 rejects unsupported USB devices in the sheet, before a selection or stock write.
 * Wi-Fi is allowed here so the operator can choose Zebra in the screen's printer selector. */
export function validateRawSplitDeviceSelection(selection: PrintDeviceSelection): void {
  if (!rawSplitPrinterSupported(rawSplitDeviceSelection(selection), 'zebra')) {
    throw new RawSplitUnsupportedPrinter('Bu USB printer qo‘llab-quvvatlanmaydi. Zebra yoki Bluetooth printerni tanlang.');
  }
}
