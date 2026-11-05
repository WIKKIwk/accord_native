import { AccordPrinter } from '../../modules/accord-printer/src/AccordPrinterModule';
import { bluetoothMaterialProductNameLines, bluetoothMaterialSplitNameLines, bluetoothPrinterText, buildBluetoothProgressLayout } from './bluetoothLayout';
import { materialDataMatrixBars } from './materialDataMatrix';
import { qolipColorDisplayName, UsbPrinterProfile, UsbPrinterTestResult, UsbRpsPrintRequest } from './printModels';

type PrinterMap = Record<string, unknown>;
const asMap = (value: unknown): PrinterMap => value && typeof value === 'object' && !Array.isArray(value) ? value as PrinterMap : {};
const asText = (value: unknown): string => value == null ? '' : String(value);

/** @v2 BluetoothPrinterProfile */
export class BluetoothPrinterProfile {
  constructor(readonly name: string, readonly address: string) {}
  static fromMap(map: PrinterMap): BluetoothPrinterProfile {
    return new BluetoothPrinterProfile(asText(map.name).trim(), asText(map.address).trim());
  }
  get printer(): string { return 'xp-p323b'; }
  get printMode(): string { return 'label'; }
  get displayName(): string { return this.name.trim() || 'XP-P323B'; }
}

/** @v2 BluetoothPrinterScanEvent */
export class BluetoothPrinterScanEvent {
  constructor(readonly printer: BluetoothPrinterProfile | null = null, readonly completed = false) {}
  static fromMap(raw: unknown): BluetoothPrinterScanEvent {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Bluetooth printer scan event is invalid');
    const map = raw as PrinterMap;
    if (asText(map.type) === 'complete') return new BluetoothPrinterScanEvent(null, true);
    if (asText(map.type) === 'printer') return new BluetoothPrinterScanEvent(BluetoothPrinterProfile.fromMap(map));
    throw new TypeError('Bluetooth printer scan event type is invalid');
  }
}

function localDateTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** @v2 _bluetoothLabelPayload */
export function bluetoothLabelPayload(request: UsbRpsPrintRequest): PrinterMap {
  const payload = request.toJson();
  if (request.isPaddonCodeLabel && request.epc.trim().startsWith('qolip-paddon:')) payload.epc = request.epc.trim();
  if (request.isProgressLabel && request.completedAtUnix > 0) payload.completed_at_label = localDateTime(request.completedAtUnix);
  if (request.isPaddonCodeLabel && request.paddonLabelLines.length) {
    payload.paddon_label_lines = request.paddonLabelLines.map(line => bluetoothPrinterText(line.replace(/—/g, '-')));
  }
  for (const key of ['item_code', 'item_name', 'order_code', 'apparatus', 'warehouse', 'unit', 'executor_name',
    'customer_name', 'manufacturer_name', 'qolip_color', 'progress_unit']) {
    const value = payload[key];
    if (typeof value === 'string') payload[key] = bluetoothPrinterText(key === 'qolip_color' ? qolipColorDisplayName(value) : value);
  }
  if (request.isProgressLabel) {
    payload.apparatus_display_name = bluetoothPrinterText(request.apparatusDisplayName);
    const layout = buildBluetoothProgressLayout(payload);
    payload.progress_lines = layout.lines; payload.progress_code_y = layout.codeY; payload.progress_code_x = layout.codeX;
  }
  if (request.isMaterialProductLabel) {
    const itemName = asText(payload.item_name);
    const sourceName = itemName || request.itemCode;
    payload.material_name_lines = request.progressUnit.trim().toLowerCase() === 'm'
      ? bluetoothMaterialSplitNameLines(sourceName) : bluetoothMaterialProductNameLines(sourceName);
  }
  return payload;
}

/** @v2 NativeBluetoothPrinter */
export class NativeBluetoothPrinter {
  private static discoverySession = 0;
  static async pairedPrinters(): Promise<BluetoothPrinterProfile[]> {
    const raw = await AccordPrinter.pairedPrinters();
    return Array.isArray(raw) ? raw.filter(value => value && typeof value === 'object' && !Array.isArray(value))
      .map(value => BluetoothPrinterProfile.fromMap(asMap(value))) : [];
  }
  static discoverPrinters(listener: (event: BluetoothPrinterScanEvent) => void): Promise<() => void> {
    const session = ++this.discoverySession;
    return AccordPrinter.startDiscovery(session, event => listener(BluetoothPrinterScanEvent.fromMap(event)));
  }
  static async printLabel(request: UsbRpsPrintRequest, printer: BluetoothPrinterProfile): Promise<PrinterMap> {
    const useDataMatrix = request.isProgressLabel || request.isPaddonCodeLabel || request.isQolipCodeLabel ||
      request.isQolipCellLabel || request.isMaterialProductLabel;
    return asMap(await AccordPrinter.printLabel({ ...bluetoothLabelPayload(request), mac_address: printer.address,
      ...(useDataMatrix ? { material_data_matrix: true, material_data_matrix_bars: materialDataMatrixBars(request.epc) } : {}) }));
  }
}

/** @v2 NativeUsbPrinter */
export class NativeUsbPrinter {
  static async printTest(title: string, payload: string): Promise<UsbPrinterTestResult> {
    return UsbPrinterTestResult.fromMap(asMap(await AccordPrinter.printTest({ title, payload })));
  }
  static async detectPrinter(): Promise<UsbPrinterProfile> {
    return UsbPrinterProfile.fromMap(asMap(await AccordPrinter.detectPrinter()));
  }
  static async printRaw(bytes: Uint8Array, printerKind: 'zebra', labelCount = 1): Promise<PrinterMap> {
    return asMap(await AccordPrinter.printRaw({ bytes: Array.from(bytes), print_count: 1, printer_kind: printerKind,
      label_count: labelCount > 0 ? labelCount : 1 }));
  }
}
