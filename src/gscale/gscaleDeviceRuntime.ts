import { appPreferences } from '../appPreferences';
import { NativeBluetoothPrinter } from '../printing/nativePrinter';
import { PrintService } from '../printing/printService';
import { SessionBluetoothPrinter } from '../printing/sessionBluetoothPrinter';
import { GScaleDeviceStore } from './gscaleDeviceState';
import { probeServer } from './gscaleDiscovery';
import { scanGscaleServers } from './gscaleDiscoveryRuntime';
import { GScalePreferences } from './gscalePreferences';

export function createGScaleDeviceStore(): GScaleDeviceStore {
  const probe = (endpoint: Parameters<typeof probeServer>[1]) => probeServer(fetch, endpoint, 2000);
  return new GScaleDeviceStore({
    preferences: new GScalePreferences(appPreferences),
    resolver: { probe, pairedPrinters: () => NativeBluetoothPrinter.pairedPrinters(),
      detectOfflinePrinter: () => PrintService.detectOfflinePrinter() },
    resolveSessionBluetooth: () => SessionBluetoothPrinter.resolveCached(),
    rememberSessionBluetooth: printer => SessionBluetoothPrinter.remember(printer),
    scan: () => scanGscaleServers(), probe,
  });
}
