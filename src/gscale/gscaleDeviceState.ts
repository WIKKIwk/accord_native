import type { BluetoothPrinterProfile } from '../printing/nativePrinter';
import type { PrintTransport } from '../printing/printTransport';
import { parseServerEndpoint, shouldSkipDiscoveryHost, type DiscoveryResult, type DiscoveredServer, type ServerEndpoint } from './gscaleDiscovery';
import { restoreLastPrintDevice, type GScalePreferences, type PrintDeviceResolver, type PrintDeviceSelection } from './gscalePreferences';

type Connection = 'wifi' | 'bluetooth' | 'usb' | null;
export type GScaleDeviceState = { selection: PrintDeviceSelection | null; transport: PrintTransport; needsAttention: boolean;
  connection: Connection; scanning: boolean; scanResult: DiscoveryResult | null; checkingAddress: boolean; addressError: string };
export type GScaleDeviceDependencies = { preferences: GScalePreferences; resolver: PrintDeviceResolver;
  resolveSessionBluetooth(): Promise<BluetoothPrinterProfile | null>; rememberSessionBluetooth(printer: BluetoothPrinterProfile): void;
  scan(): Promise<DiscoveryResult>; probe(endpoint: ServerEndpoint): Promise<DiscoveredServer | null> };

/** Selection and scan state from _GScaleMobileAppState and _ServerPickerPageState. */
export class GScaleDeviceStore {
  private state: GScaleDeviceState = { selection: null, transport: 'wifi', needsAttention: false, connection: null,
    scanning: false, scanResult: null, checkingAddress: false, addressError: '' };
  private listeners = new Set<() => void>();
  private alive = true;
  constructor(private readonly deps: GScaleDeviceDependencies,
    private readonly allowSelection?: (selection: PrintDeviceSelection) => boolean) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(patch: Partial<GScaleDeviceState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** @v2 _restoreLastPrintDevice */
  async restore(): Promise<void> {
    const bluetooth = await this.deps.resolveSessionBluetooth();
    if (!this.alive) return;
    if (bluetooth) {
      const selection: PrintDeviceSelection = { transport: 'bluetooth', bluetoothPrinter: bluetooth };
      if (!this.allowSelection || this.allowSelection(selection)) {
        this.update({ selection, transport: 'bluetooth', needsAttention: false });
        await this.deps.preferences.saveLastPrintDevice(selection);
        return;
      }
      this.update({ needsAttention: true });
    }
    const saved = await this.deps.preferences.loadLastPrintDevice();
    if (!saved) return;
    const selection = await restoreLastPrintDevice(saved, this.deps.resolver);
    if (!this.alive) return;
    if (!selection || (this.allowSelection && !this.allowSelection(selection))) { this.update({ needsAttention: true }); return; }
    this.update({ selection, transport: selection.transport, needsAttention: false });
  }

  /** @v2 _applyDeviceSelection */
  async select(selection: PrintDeviceSelection): Promise<void> {
    if (!this.alive) return;
    if (this.allowSelection && !this.allowSelection(selection)) { this.update({ needsAttention: true }); throw new Error('Printer ulanmagan'); }
    this.update({ selection, transport: selection.transport, needsAttention: false });
    if (selection.transport === 'bluetooth') this.deps.rememberSessionBluetooth(selection.bluetoothPrinter);
    await this.deps.preferences.saveLastPrintDevice(selection);
  }

  /** @v2 _clearSelectedServer */
  clearServer(): void { this.update({ selection: null, needsAttention: true }); }

  /** @v2 _selectConnection */
  selectConnection(connection: Connection): void {
    this.update({ connection });
    if (connection === 'wifi') void this.scan();
  }

  /** @v2 _scan */
  async scan(): Promise<void> {
    if (this.state.scanning) return;
    this.update({ scanning: true });
    try {
      const result = await this.deps.scan();
      this.update({ scanResult: result, scanning: false });
    } catch {
      this.update({ scanResult: this.state.scanResult ?? { servers: [], candidateCount: 0 }, scanning: false });
    }
  }

  /** @v2 _ManualServerSheetState._submit */
  async checkAddress(raw: string): Promise<DiscoveredServer | null> {
    if (this.state.checkingAddress) return null;
    this.update({ checkingAddress: true, addressError: '' });
    const endpoint = parseServerEndpoint(raw);
    if (!endpoint) { this.update({ checkingAddress: false, addressError: 'Manzil formati noto‘g‘ri' }); return null; }
    if (shouldSkipDiscoveryHost(endpoint.host)) {
      this.update({ checkingAddress: false, addressError: 'Localhost emas, Wi‑Fi server manzilini kiriting' }); return null;
    }
    const server = await this.deps.probe(endpoint);
    if (!this.alive) return null;
    if (!server) this.update({ checkingAddress: false, addressError: 'Bu server bilan qo‘shilish muvaffaqiyatsiz' });
    else this.update({ checkingAddress: false });
    return server;
  }

  dispose(): void { this.alive = false; this.listeners.clear(); }
}
