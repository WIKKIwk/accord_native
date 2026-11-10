import { NativeBluetoothPrinter } from '../printing/nativePrinter';
import type { PreparationDeviceSelection } from './preparationPrinter';
import type { usePreparationDialogs } from './PreparationUI.android';

type Dialogs = ReturnType<typeof usePreparationDialogs>;

export async function selectPreparationDevice(dialogs: Dialogs, isCurrent: () => boolean): Promise<PreparationDeviceSelection | null> {
  // USB and Wi-Fi printing are temporarily disabled by Wikki.
  const mode = await dialogs.choose('Printer tanlang', [{ label: 'Bluetooth printer', value: 'bluetooth' }]);
  if (mode !== 'bluetooth' || !isCurrent()) return null;
  while (isCurrent()) {
    const devices = await NativeBluetoothPrinter.pairedPrinters();
    if (!isCurrent()) return null;
    if (!devices.length) {
      const retry = await dialogs.choose('Bluetooth printer topilmadi', [{ label: 'Qayta qidirish', value: 'retry' }],
        'Printerni Android Bluetooth sozlamalarida avval bog‘lang (pair).');
      if (retry === 'retry') continue;
      return null;
    }
    const address = await dialogs.choose('Bluetooth printer', devices.map(device => ({ label: device.displayName, subtitle: device.address, value: device.address })));
    const printer = devices.find(device => device.address === address);
    return printer && isCurrent() ? { transport: 'bluetooth', printer } : null;
  }
  return null;
}

export async function selectPreparationInventoryDevice(dialogs: Dialogs, isCurrent: () => boolean): Promise<PreparationDeviceSelection | null> {
  return selectPreparationDevice(dialogs, isCurrent);
}
