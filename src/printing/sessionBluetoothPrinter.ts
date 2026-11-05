import { Platform } from 'react-native';
import { BluetoothPrinterProfile, NativeBluetoothPrinter } from './nativePrinter';

/** @v2 SessionBluetoothPrinter */
export class SessionBluetoothPrinter {
  private static printer: BluetoothPrinterProfile | null = null;
  static get cached(): BluetoothPrinterProfile | null { return this.printer; }
  static remember(printer: BluetoothPrinterProfile): void { if (printer.address.trim()) this.printer = printer; }
  static forget(): void { this.printer = null; }
  static forgetIfMatches(address: string | null): void {
    if (address != null && this.printer && this.normalize(this.printer.address) === this.normalize(address)) this.printer = null;
  }
  static async resolveCached(): Promise<BluetoothPrinterProfile | null> {
    const cached = this.printer;
    if (!cached || !cached.address.trim()) return null;
    if (Platform.OS === 'ios' || Platform.OS === 'web') return cached;
    try {
      const paired = await NativeBluetoothPrinter.pairedPrinters();
      const wanted = this.normalize(cached.address);
      for (const printer of paired) if (this.normalize(printer.address) === wanted) return printer.address.trim() ? printer : cached;
      this.printer = null;
      return null;
    } catch { return null; }
  }
  private static normalize(value: string): string { return value.trim().toLowerCase().replace(/[^a-f0-9]/g, ''); }
}
