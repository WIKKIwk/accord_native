import { appPreferences } from '../appPreferences';
import { NativeBluetoothPrinter } from '../printing/nativePrinter';
import { PrintService } from '../printing/printService';
import { SessionBluetoothPrinter } from '../printing/sessionBluetoothPrinter';
import { GScaleDeviceStore } from './gscaleDeviceState';
import { probeServer } from './gscaleDiscovery';
import { scanGscaleServers } from './gscaleDiscoveryRuntime';
import { GScalePreferences, type PrintDeviceSelection } from './gscalePreferences';
import type { AccountStorage } from '../savedAccountStore';

export function createGScaleDeviceStore(options: { storage?: AccountStorage; allowSelection?: (selection: PrintDeviceSelection) => boolean;
  rememberBluetooth?: boolean } = {}): GScaleDeviceStore {
  const probe = (endpoint: Parameters<typeof probeServer>[1]) => probeServer(fetch, endpoint, 2000);
  return new GScaleDeviceStore({
    preferences: new GScalePreferences(options.storage ?? appPreferences),
    resolver: { probe, pairedPrinters: () => NativeBluetoothPrinter.pairedPrinters(),
      detectOfflinePrinter: () => PrintService.detectOfflinePrinter() },
    resolveSessionBluetooth: () => SessionBluetoothPrinter.resolveCached(),
    rememberSessionBluetooth: printer => { if (options.rememberBluetooth !== false) SessionBluetoothPrinter.remember(printer); },
    scan: () => scanGscaleServers(), probe,
  }, options.allowSelection);
}
