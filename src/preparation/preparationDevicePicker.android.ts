import { driverUrlForRs, printTargetLabel } from '../gscale/gscaleDiscovery';
import { scanGscaleServers } from '../gscale/gscaleDiscoveryRuntime';
import { NativeBluetoothPrinter } from '../printing/nativePrinter';
import { PrintService } from '../printing/printService';
import { preparationManualPrinterServer, type PreparationDeviceSelection } from './preparationPrinter';
import type { usePreparationDialogs } from './PreparationUI.android';

type Dialogs = ReturnType<typeof usePreparationDialogs>;

export async function selectPreparationDevice(dialogs: Dialogs, isCurrent: () => boolean): Promise<PreparationDeviceSelection | null> {
  const mode = await dialogs.choose('Printer tanlang', [{ label: 'USB printer', value: 'usb' },
    { label: 'Bluetooth printer', value: 'bluetooth' }, { label: 'Wi-Fi qurilma', value: 'wifi' }]);
  if (!mode || !isCurrent()) return null;
  if (mode === 'usb') {
    const printer = await PrintService.detectOfflinePrinter();
    return isCurrent() ? { transport: 'offline', printer } : null;
  }
  if (mode === 'bluetooth') {
    const devices = await NativeBluetoothPrinter.pairedPrinters();
    if (!isCurrent()) return null;
    if (!devices.length) { dialogs.message('Printer topilmadi', 'Bluetooth printer topilmadi.'); return null; }
    const address = await dialogs.choose('Bluetooth printer', devices.map(device => ({ label: device.displayName, subtitle: device.address, value: device.address })));
    const printer = devices.find(device => device.address === address);
    return printer && isCurrent() ? { transport: 'bluetooth', printer } : null;
  }
  if (mode !== 'wifi') return null;
  while (isCurrent()) {
    const servers = await scanGscaleServers().then(result => result.servers, () => []);
    if (!isCurrent()) return null;
    const selection = await dialogs.choose('Wi-Fi qurilma', [
      ...servers.map((server, index) => ({ label: printTargetLabel(server), subtitle: server.endpoint.baseUrl, value: `server:${index}` })),
      { label: 'Server qo‘shish', value: 'manual' }, { label: 'Qayta qidirish', value: 'rescan' },
    ]);
    if (!selection || !isCurrent()) return null;
    if (selection === 'rescan') continue;
    if (selection === 'manual') {
      const address = await dialogs.input({ title: 'Server qo‘shish', label: 'Server manzili', initial: 'http://gscale.local:39117' });
      if (!address || !isCurrent()) return null;
      const selected = await preparationManualPrinterServer(address);
      return isCurrent() ? selected : null;
    }
    const server = servers.find((_entry, index) => selection === `server:${index}`);
    if (server) return { transport: 'wifi', serverBaseUrl: server.endpoint.baseUrl, driverBaseUrl: driverUrlForRs(server) };
    return null;
  }
  return null;
}

export async function selectPreparationInventoryDevice(dialogs: Dialogs, isCurrent: () => boolean): Promise<PreparationDeviceSelection | null> {
  const selected = await selectPreparationDevice(dialogs, isCurrent);
  return selected?.transport === 'wifi' ? { transport: 'wifi', serverBaseUrl: selected.serverBaseUrl } : selected;
}
