import { Platform } from 'react-native';
import type { PreparationDeviceSelection } from '../preparation/preparationPrinter';
import { PrintService } from '../printing/printService';
import { rawSplitPrint, rawSplitSessionIsCurrent, requireRawSplitRealAccount, type RawSplitSessionTicket } from './rawSplitApi';
import type { RawSplitResult, RawSplitRoll } from './rawSplitModel';
import { rawMaterialSplitPrintRequest } from './rawSplitPrinting';
import { rawSplitWriteDispatchAllowed } from './rawSplitWritePolicy';

export class RawSplitUnsupportedPrinter extends Error {}
/** USB cannot bind exact identity; iOS Bluetooth does not recheck the selected UUID at dispatch. */
export function rawSplitPrinterSupported(device: PreparationDeviceSelection, wifiPrinter: string): boolean {
  if (device.transport === 'bluetooth') return Platform.OS === 'android';
  if (device.transport === 'offline') return false;
  return wifiPrinter === 'zebra' && !!device.driverBaseUrl;
}

/** Explain only choices that are actually available on the current platform. */
export function rawSplitUnsupportedReason(transport: PreparationDeviceSelection['transport']): string {
  if (transport === 'offline') return Platform.OS === 'ios'
    ? 'USB printer qurilmasini aniq tekshirib bo‘lmaydi. Wi-Fi Zebra tanlang.'
    : 'USB printer qurilmasini aniq tekshirib bo‘lmaydi. Bluetooth yoki Wi-Fi Zebra tanlang.';
  if (transport === 'bluetooth') return 'iOS Bluetooth printerini aniq tekshirib bo‘lmaydi. Wi-Fi Zebra tanlang.';
  return Platform.OS === 'ios' ? 'GoDEX qo‘llab-quvvatlanmaydi. Wi-Fi Zebra tanlang.'
    : 'GoDEX qo‘llab-quvvatlanmaydi. Bluetooth yoki Wi-Fi Zebra tanlang.';
}

/** Print one existing child roll through the existing native bridge or V2 Wi-Fi API. */
export async function printRawSplitRoll(ticket: RawSplitSessionTicket, result: RawSplitResult, output: RawSplitRoll,
  device: PreparationDeviceSelection, wifiPrinter: string, guard: () => void): Promise<void> {
  requireRawSplitRealAccount(ticket);
  if (!rawSplitWriteDispatchAllowed()) throw new Error('Chop etish xavfsizlik tekshiruvi tugaguncha to‘xtatilgan');
  guard(); if (!rawSplitSessionIsCurrent(ticket)) throw new Error('Akkaunt o‘zgargan');
  if (!rawSplitPrinterSupported(device, wifiPrinter)) throw new RawSplitUnsupportedPrinter();
  if (device.transport === 'wifi') {
    await rawSplitPrint(ticket, { splitId: result.id, barcode: output.barcode, driverUrl: device.driverBaseUrl!,
      printer: wifiPrinter, printMode: 'label' }, guard);
    return;
  }
  const request = rawMaterialSplitPrintRequest(output);
  guard(); requireRawSplitRealAccount(ticket); if (!rawSplitSessionIsCurrent(ticket)) throw new Error('Akkaunt o‘zgargan');
  const response = await PrintService.printRps(request, device.transport === 'offline'
    ? { transport: 'offline', printerProfile: device.printer }
    : { transport: 'bluetooth', bluetoothPrinter: device.printer });
  if (!rawSplitSessionIsCurrent(ticket)) throw new Error('Akkaunt o‘zgargan'); guard();
  if (!response.ok || response.status !== 'done') throw new Error('Printer natijani tasdiqlamadi');
}

/** V2 prints each output once, in returned order, with scope checked before each. */
export async function printRawSplitResult(ticket: RawSplitSessionTicket, result: RawSplitResult, device: PreparationDeviceSelection,
  wifiPrinter: string, guard: () => void): Promise<void> {
  for (const output of result.outputs) await printRawSplitRoll(ticket, result, output, device, wifiPrinter, guard);
}
