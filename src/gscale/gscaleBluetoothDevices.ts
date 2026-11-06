import type { BluetoothPrinterProfile, BluetoothPrinterScanEvent } from '../printing/nativePrinter';

/** Platform selection from V2 BluetoothPrinterList._load. */
export async function watchGScaleBluetoothDevices(platform: string, native: {
  pairedPrinters(): Promise<BluetoothPrinterProfile[]>;
  discoverPrinters(listener: (event: BluetoothPrinterScanEvent) => void): Promise<() => void>;
}, update: (event: { printer?: BluetoothPrinterProfile; complete?: boolean; paired?: BluetoothPrinterProfile[] }) => void) {
  if (platform === 'ios') return native.discoverPrinters(event => update({
    ...(event.printer ? { printer: event.printer } : {}), ...(event.completed ? { complete: true } : {}) }));
  update({ paired: await native.pairedPrinters(), complete: true });
  return () => {};
}
