import type { AccountStorage } from '../savedAccountStore';
import type { GScaleOperatorState } from './gscaleOperatorState';
import type { PrintDeviceSelection } from './gscalePreferences';

export type MaterialGScaleOperation = 'start' | 'stop' | 'print' | 'archive' | 'reprint';
export type MaterialGScaleExpectation = { selection?: string; batchId?: string; batchRevision?: number;
  requestPrinter?: string; requestDriverUrl?: string };
const denied = () => new Error('Printer ulanmagan');
const canonical = (value: string) => value.trim().toLowerCase();

/** Stable selection identity for the same Wi-Fi, Bluetooth and USB choices V2 offers. */
export function materialReceiptPrinterSelectionKey(selection: PrintDeviceSelection | null): string | null {
  if (!selection) return null;
  if (selection.transport === 'wifi') return `wifi:${selection.server.endpoint.baseUrl}`;
  if (selection.transport === 'bluetooth') return `bluetooth:${selection.bluetoothPrinter.address.trim().toLowerCase()}`;
  const printer = selection.offlinePrinter;
  if (canonical(printer.kind) === 'godex' || canonical(printer.printer) === 'godex') return null;
  return `usb:${printer.vendorId}:${printer.productId}:${printer.deviceName.trim()}`;
}

/** Material's V2 receipt flow, with the project's explicit GoDEX exclusion (D13). */
export class MaterialReceiptPrinterPolicy {
  readonly receiptPresentation = true;
  readonly restrictPrinter = true;
  constructor(private readonly isCurrent: () => boolean) {}
  isPrinterChoiceAllowed(value: string): boolean { return canonical(value) === 'zebra'; }
  allowSelection(selection: PrintDeviceSelection): boolean { return this.isCurrent() && !!materialReceiptPrinterSelectionKey(selection); }
  assertOperation(_operation: MaterialGScaleOperation, state: GScaleOperatorState, expected: MaterialGScaleExpectation = {}): void {
    if (!this.isCurrent()) throw new Error('Sessiya tugagan. Qayta kiring.');
    const key = materialReceiptPrinterSelectionKey(state.device.selection);
    if (!key || state.device.needsAttention || state.device.transport !== state.device.selection?.transport ||
        (expected.selection != null && expected.selection !== key) ||
        !this.isPrinterChoiceAllowed(state.draft.printer) ||
        canonical(state.batch.batch?.printer ?? '') === 'godex' ||
        canonical(state.monitor?.printerKind ?? '') === 'godex' ||
        /^(?:godex|go-dex)/.test(canonical(state.monitor?.printerLabel ?? '')) ||
        (expected.requestPrinter != null && canonical(expected.requestPrinter) === 'godex')) throw denied();
    const batch = state.batch.batch;
    if (expected.batchId != null && batch?.id !== expected.batchId) throw denied();
    if (expected.batchRevision != null && batch?.revision !== expected.batchRevision) throw denied();
  }
}

/**
 * The existing USB bridge classifies Zebra by its USB vendor or descriptor; Bluetooth discovery filters XP-P323B.
 * This is a previously observed selection, not an atomic connection to a physical device.
 * Material GScale must stay unexposed until native device identity is bound and independently reviewed.
 * Wi-Fi is denied until a live, device-bound printer identity can be proven at every write boundary.
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
    if (state.device.needsAttention || !key || state.device.transport !== selected?.transport ||
        (expected.selection != null && expected.selection !== key)) throw denied();
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
