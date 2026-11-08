import type { AccountStorage } from '../savedAccountStore';
import type { GScaleOperatorState } from './gscaleOperatorState';
import type { PrintDeviceSelection } from './gscalePreferences';

export type MaterialGScaleOperation = 'start' | 'stop' | 'print' | 'archive' | 'reprint';
export type MaterialGScaleExpectation = { selection?: string; batchId?: string; batchRevision?: number;
  requestPrinter?: string; requestDriverUrl?: string };
const denied = () => new Error('Printer ulanmagan');
const canonical = (value: string) => value.trim().toLowerCase();

/**
 * The existing USB bridge classifies Zebra by its USB vendor or descriptor; Bluetooth discovery filters XP-P323B.
 * Wi-Fi is intentionally denied until a live, device-bound printer identity can be proven at every write boundary.
 */
export function materialPrinterSelectionKey(selection: PrintDeviceSelection | null): string | null {
  if (!selection) return null;
  if (selection.transport === 'wifi') return null;
  if (selection.transport === 'bluetooth') {
    const printer = selection.bluetoothPrinter, name = printer.name.toUpperCase().replace(/[-_\s]/g, '');
    const address = printer.address.trim();
    if (!name.includes('P323B') || !address || canonical(printer.printer) !== 'xp-p323b') return null;
    return `bluetooth:${address.toLowerCase()}`;
  }
  const printer = selection.offlinePrinter;
  const description = `${printer.manufacturerName} ${printer.productName}`.toLowerCase();
  if (printer.kind !== 'zebra' || canonical(printer.printer) !== 'zebra' || !printer.deviceName.trim() ||
      (printer.vendorId !== 0x0a5f && !description.includes('zebra'))) return null;
  return `usb:${printer.vendorId}:${printer.productId}:${printer.deviceName.trim()}`;
}

/** Default-off policy. Call only for an explicitly restricted Material runtime. */
export class MaterialGScalePolicy {
  readonly restrictPrinter = true;
  constructor(private readonly isCurrent: () => boolean) {}
  isPrinterChoiceAllowed(value: string): boolean { return canonical(value) === 'zebra'; }
  allowSelection(selection: PrintDeviceSelection): boolean { return this.isCurrent() && !!materialPrinterSelectionKey(selection); }
  assertOperation(operation: MaterialGScaleOperation, state: GScaleOperatorState, expected: MaterialGScaleExpectation = {}): void {
    if (!this.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.');
    const selected = state.device.selection, key = materialPrinterSelectionKey(selected);
    if (!key || state.device.transport !== selected?.transport || (expected.selection != null && expected.selection !== key)) throw denied();
    if (expected.requestPrinter != null && canonical(expected.requestPrinter) !== 'zebra') throw denied();
    if (expected.requestDriverUrl != null && expected.requestDriverUrl.trim() !== 'usb://local') throw denied();
    const { batch, resolved } = state.batch;
    const activeBatchSafe = !!batch?.active && canonical(batch.printer) === 'zebra' && batch.driver_url.trim() === 'usb://local';
    if (operation === 'start') {
      if (!resolved || batch?.active || !this.isPrinterChoiceAllowed(state.draft.printer)) throw denied();
    } else if (operation === 'stop' || operation === 'print') {
      if (!resolved || !activeBatchSafe) throw denied();
    } else if (!resolved || (batch?.active && !activeBatchSafe)) {
      throw denied();
    }
    if (expected.batchId != null && (!batch || expected.batchId !== batch.id)) throw denied();
    if (expected.batchRevision != null && (!batch || expected.batchRevision !== batch.revision)) throw denied();
  }
}

/** Material reads legacy selections without ever overwriting or deleting the other roles' saved preferences. */
export function materialPreferenceOverlay(base: AccountStorage): AccountStorage {
  const values = new Map<string, string | null>();
  return {
    async getItem(key) { return values.has(key) ? values.get(key) ?? null : base.getItem(key); },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.set(key, null); },
  };
}
