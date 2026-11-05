import { isCanonicalApparatusId } from '../workerControlsApi';

type MapValue = Record<string, unknown>;
const text = (value: unknown): string => value == null ? '' : String(value);
const number = (value: unknown, fallback = 0): number => {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Expected a number');
  return value;
};
const clean = (value: string, fallback: string): string => value.trim() || fallback;
const compactQty = (value: number): string => value.toFixed(3).replace(/\.?0+$/, '');

/** @v2 UsbPrinterKind */
export type UsbPrinterKind = 'godex' | 'zebra';
export function parseUsbPrinterKind(value: unknown): UsbPrinterKind {
  switch (text(value).trim().toLowerCase()) {
    case 'godex': case 'go-dex': case 'g500': return 'godex';
    case 'zebra': case 'zpl': case 'rfid': return 'zebra';
    default: throw new Error('USB printer is neither GoDEX nor Zebra');
  }
}

/** @v2 UsbPrinterProfile */
export class UsbPrinterProfile {
  constructor(
    readonly kind: UsbPrinterKind, readonly deviceName: string, readonly vendorId: number,
    readonly productId: number, readonly manufacturerName: string, readonly productName: string,
  ) {}
  static fromMap(map: MapValue): UsbPrinterProfile {
    return new UsbPrinterProfile(parseUsbPrinterKind(map.printer), text(map.deviceName),
      Math.trunc(number(map.vendorId)), Math.trunc(number(map.productId)),
      text(map.manufacturerName), text(map.productName));
  }
  get printer(): string { return this.kind; }
  get printMode(): string { return this.kind === 'zebra' ? 'rfid' : 'label'; }
  get supportsRfid(): boolean { return this.kind === 'zebra'; }
  get displayName(): string {
    const brand = this.kind === 'zebra' ? 'Zebra' : 'GoDEX';
    return this.productName.trim() ? `${brand} • ${this.productName.trim()}` : brand;
  }
}

/** @v2 UsbPrinterTestResult */
export class UsbPrinterTestResult {
  constructor(readonly ok: boolean, readonly bytes: number, readonly deviceName: string,
    readonly vendorId: number, readonly productId: number) {}
  static fromMap(map: MapValue): UsbPrinterTestResult {
    return new UsbPrinterTestResult(map.ok === true, Math.trunc(number(map.bytes)), text(map.deviceName),
      Math.trunc(number(map.vendorId)), Math.trunc(number(map.productId)));
  }
}

export type UsbRpsPrintRequestOptions = {
  epc: string; itemCode: string; itemName: string; warehouse: string; printer: string;
  printMode: string; grossQty: number; orderCode?: string; apparatus?: string;
  apparatusDisplayName?: string; unit?: string; tareEnabled?: boolean; tareKg?: number;
  includeBobinaInNet?: boolean; printCount?: number; labelKind?: string; executorName?: string;
  customerName?: string; manufacturerName?: string; qolipColor?: string; progressQty?: number | null;
  progressUnit?: string; completedAtUnix?: number; paddonLabelLines?: readonly string[];
};

/** @v2 UsbRpsPrintRequest */
export class UsbRpsPrintRequest {
  readonly epc: string; readonly itemCode: string; readonly itemName: string;
  readonly warehouse: string; readonly printer: string; readonly printMode: string; readonly grossQty: number;
  readonly orderCode: string; readonly apparatus: string; readonly apparatusDisplayName: string;
  readonly unit: string; readonly tareEnabled: boolean; readonly tareKg: number;
  readonly includeBobinaInNet: boolean; readonly printCount: number; readonly labelKind: string;
  readonly executorName: string; readonly customerName: string; readonly manufacturerName: string;
  readonly qolipColor: string; readonly progressQty: number | null; readonly progressUnit: string;
  readonly completedAtUnix: number; readonly paddonLabelLines: readonly string[];

  constructor(options: UsbRpsPrintRequestOptions) {
    this.epc = options.epc; this.itemCode = options.itemCode; this.itemName = options.itemName;
    this.warehouse = options.warehouse; this.printer = options.printer; this.printMode = options.printMode;
    this.grossQty = options.grossQty; this.orderCode = options.orderCode ?? ''; this.apparatus = options.apparatus ?? '';
    this.apparatusDisplayName = options.apparatusDisplayName ?? ''; this.unit = options.unit ?? 'kg';
    this.tareEnabled = options.tareEnabled ?? false; this.tareKg = options.tareKg ?? 0;
    this.includeBobinaInNet = options.includeBobinaInNet ?? false; this.printCount = options.printCount ?? 1;
    this.labelKind = options.labelKind ?? ''; this.executorName = options.executorName ?? '';
    this.customerName = options.customerName ?? ''; this.manufacturerName = options.manufacturerName ?? '';
    this.qolipColor = options.qolipColor ?? ''; this.progressQty = options.progressQty ?? null;
    this.progressUnit = options.progressUnit ?? ''; this.completedAtUnix = options.completedAtUnix ?? 0;
    this.paddonLabelLines = options.paddonLabelLines ?? [];
  }

  static test(epc: string): UsbRpsPrintRequest {
    return new UsbRpsPrintRequest({ epc, itemCode: 'USB-TEST', itemName: 'USB printer test',
      warehouse: 'RPS USB TEST', printer: 'godex', printMode: 'label', grossQty: 1 });
  }

  static fromPrintJson(json: MapValue, options: { paddonLabelLines?: readonly string[]; completedAtUnix?: number } = {}): UsbRpsPrintRequest {
    const executorName = text(json.executor_name).trim();
    const apparatus = text(json.apparatus).trim();
    if (apparatus && !isCanonicalApparatusId(apparatus)) throw new TypeError('Canonical apparatus ID is required');
    const labelKind = text(json.label_kind);
    const kind = labelKind.trim().toLowerCase();
    const rawProgress = json.progress_qty ?? ((kind === 'progress' || kind === 'opening_wip') ? json.qty : null);
    return new UsbRpsPrintRequest({
      epc: text(json.epc ?? json.qr_payload), itemCode: text(json.item_code), itemName: text(json.item_name),
      orderCode: text(json.order_code), apparatus, apparatusDisplayName: text(json.apparatus_display_name).trim(),
      warehouse: json.warehouse == null ? (executorName ? `Ijrochi: ${executorName}` : 'ACCORD') : text(json.warehouse),
      printer: json.printer == null ? 'godex' : text(json.printer),
      printMode: json.print_mode == null && json.mode == null ? 'label' : text(json.print_mode ?? json.mode),
      grossQty: number(json.gross_qty ?? json.qty), unit: json.unit == null ? 'kg' : text(json.unit),
      tareEnabled: json.tare_enabled === true || json.tare === true, tareKg: number(json.tare_kg),
      includeBobinaInNet: json.include_bobina_in_net === true, printCount: Math.trunc(number(json.print_count, 1)),
      labelKind, executorName, customerName: text(json.customer_name), manufacturerName: text(json.manufacturer_name).trim(),
      qolipColor: text(json.qolip_color), progressQty: rawProgress == null ? null : number(rawProgress),
      progressUnit: text(json.progress_unit), completedAtUnix: options.completedAtUnix && options.completedAtUnix > 0
        ? options.completedAtUnix : Math.trunc(number(json.completed_at_unix)),
      paddonLabelLines: kind === 'paddon_code' ? [...(options.paddonLabelLines ?? [])] : [],
    });
  }

  get isProgressLabel(): boolean { return ['progress', 'opening_wip'].includes(this.labelKind.trim().toLowerCase()); }
  get isQolipCellLabel(): boolean { return ['qolip_cell', 'qr_center'].includes(this.labelKind.trim().toLowerCase()); }
  get isQolipCodeLabel(): boolean { return this.labelKind.trim().toLowerCase() === 'qolip_code'; }
  get isPaddonCodeLabel(): boolean { return this.labelKind.trim().toLowerCase() === 'paddon_code'; }
  get isMaterialProductLabel(): boolean { return this.labelKind.trim().toLowerCase() === 'material_product'; }
  get netIncludesBobina(): boolean { return this.includeBobinaInNet && this.isProgressLabel; }
  get netQty(): number { return Math.max(0, this.netIncludesBobina ? this.grossQty : this.grossQty - this.tareKg); }
  get effectiveProgressQty(): number { return this.progressQty ?? this.netQty; }
  get materialProductLabelTitle(): string {
    const name = this.itemName.trim() || this.itemCode.trim();
    const unit = this.unit.trim() || 'kg';
    const meterPart = this.progressQty != null && this.progressQty > 0
      ? ` Metri: ${compactQty(this.progressQty)} ${this.progressUnit.trim() || 'm'}` : '';
    const hasMaterialMeter = this.progressQty != null && Number.isFinite(this.progressQty) && this.progressQty > 0 && !!this.progressUnit.trim();
    if (this.tareEnabled || hasMaterialMeter) return `${name}  B:${compactQty(this.grossQty)} ${unit} N:${compactQty(this.netQty)} ${unit}${meterPart}`;
    return `${name}  ${compactQty(this.netQty)} ${unit}${meterPart}`;
  }
  largeQrLabelFooter(qrPayload: string): string {
    const payload = qrPayload.trim();
    if (this.isMaterialProductLabel) return `EPC: ${payload}`;
    if (this.isQolipCodeLabel && payload.toUpperCase().startsWith('RPS-BATCH:')) return `BATCH ID: ${payload.substring(10)}`;
    return this.itemCode.trim() || payload;
  }
  forPrinter(profile: UsbPrinterProfile): UsbRpsPrintRequest {
    return new UsbRpsPrintRequest({ ...this, printer: profile.printer, printMode: profile.printMode, paddonLabelLines: [] });
  }
  forQolipCell(cellLabel: string): UsbRpsPrintRequest {
    return new UsbRpsPrintRequest({ ...this, itemName: cellLabel.trim(), orderCode: '', manufacturerName: '',
      includeBobinaInNet: false, completedAtUnix: 0, paddonLabelLines: [], labelKind: 'qolip_cell' });
  }
  forQolipCode(name: string, code: string, payload: string, customerName = '', qolipColor = ''): UsbRpsPrintRequest {
    return new UsbRpsPrintRequest({ ...this, epc: payload.trim(), itemCode: code.trim(), itemName: name.trim(), orderCode: '',
      manufacturerName: '', includeBobinaInNet: false, completedAtUnix: 0, paddonLabelLines: [], labelKind: 'qolip_code',
      customerName: customerName.trim() || this.customerName, qolipColor: qolipColor.trim() || this.qolipColor });
  }
  toJson(): Record<string, unknown> {
    return {
      epc: clean(this.epc, 'RPS-USB-TEST').toUpperCase(), item_code: clean(this.itemCode, 'USB-TEST'),
      item_name: clean(this.itemName, 'USB printer test'),
      ...(this.isProgressLabel && this.orderCode.trim() ? { order_code: this.orderCode.trim() } : {}),
      ...(this.apparatus.trim() ? { apparatus: this.apparatus.trim() } : {}),
      ...(this.apparatusDisplayName.trim() ? { apparatus_display_name: this.apparatusDisplayName.trim() } : {}),
      warehouse: clean(this.warehouse, 'RPS USB TEST'), printer: clean(this.printer, 'godex').toLowerCase(),
      print_mode: clean(this.printMode, 'label').toLowerCase(), gross_qty: Number.isFinite(this.grossQty) && this.grossQty > 0 ? this.grossQty : 1,
      unit: clean(this.unit, 'kg').toLowerCase(), tare_enabled: this.tareEnabled || this.tareKg > 0,
      tare_kg: Number.isFinite(this.tareKg) && this.tareKg > 0 ? this.tareKg : 0,
      ...(this.netIncludesBobina ? { include_bobina_in_net: true } : {}), print_count: this.printCount > 1 ? this.printCount : 1,
      ...(this.labelKind.trim() ? { label_kind: this.labelKind.trim().toLowerCase() } : {}),
      ...(this.executorName.trim() ? { executor_name: this.executorName.trim() } : {}),
      ...(this.customerName.trim() ? { customer_name: this.customerName.trim() } : {}),
      ...(this.manufacturerName.trim() ? { manufacturer_name: this.manufacturerName.trim() } : {}),
      ...(this.qolipColor.trim() ? { qolip_color: this.qolipColor.trim() } : {}),
      ...(this.progressQty != null ? { progress_qty: this.progressQty } : {}),
      ...(this.progressUnit.trim() ? { progress_unit: this.progressUnit.trim() } : {}),
      ...(this.isProgressLabel && this.completedAtUnix > 0 ? { completed_at_unix: this.completedAtUnix } : {}),
    };
  }
}

/** @v2 UsbRpsPrintResponse */
export class UsbRpsPrintResponse {
  constructor(readonly ok: boolean, readonly status: string, readonly epc: string, readonly itemCode: string,
    readonly itemName: string, readonly warehouse: string, readonly printer: string, readonly mode: string,
    readonly grossQty: number, readonly netQty: number, readonly unit: string, readonly printerStatus: string,
    readonly printCount: number, readonly bytes: number, readonly deviceName: string, readonly vendorId: number,
    readonly productId: number) {}
  static fromMap(map: MapValue): UsbRpsPrintResponse {
    return new UsbRpsPrintResponse(map.ok === true, text(map.status), text(map.epc), text(map.item_code),
      text(map.item_name), text(map.warehouse), text(map.printer), text(map.mode), number(map.gross_qty), number(map.net_qty),
      text(map.unit), text(map.printer_status), Math.trunc(number(map.print_count, 1)), Math.trunc(number(map.bytes)),
      text(map.deviceName), Math.trunc(number(map.vendorId)), Math.trunc(number(map.productId)));
  }
}

/** @v2 qolipColorDisplayName */
export function qolipColorDisplayName(value: string): string {
  const names: Record<string, string> = { E53935: 'Qizil', FB8C00: 'To‘q sariq', FDD835: 'Sariq', '43A047': 'Yashil',
    '00ACC1': 'Moviy', '1E88E5': 'Ko‘k', '3949AB': 'To‘q ko‘k', '8E24AA': 'Binafsha', D81B60: 'Pushti',
    '6D4C41': 'Jigarrang', D4A72C: 'Tilla', '757575': 'Kulrang', B7BCC2: 'Matlak', '212121': 'Qora', FFFFFF: 'Oq' };
  return names[value.trim().replace('#', '').toUpperCase()] ?? value.trim();
}
