import { normalizePrinterChoice, normalizeQuantitySource } from './gscaleControlLogic';
import type { GScaleBatchSession } from './gscaleBatchModel';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid monitor object');
  return value as Obj;
};
const text = (value: unknown, fallback = '') => value == null || !String(value).trim() ? fallback : String(value).trim();
const bool = (value: unknown) => value === true || ['true', '1', 'yes'].includes(text(value).toLowerCase());
const number = (value: unknown) => {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid monitor number');
  return value;
};

/** @v2 buildScaleConnectionLabel */
export function buildScaleConnectionLabel(source: string, port: string, error: string): string {
  return !error.trim() && (!!source.trim() || !!port.trim()) ? 'Scale: ulangan' : 'Scale: ulanmagan';
}
/** @v2 buildPrinterConnectionLabel */
export function buildPrinterConnectionLabel(connected: boolean, label: string): string {
  if (!connected) return 'ulanmagan';
  const value = label.trim();
  return !value || value.toLowerCase() === 'ulanmagan' ? 'ulangan' : value;
}
/** @v2 derivePrinterState */
export function derivePrinterState(printStatus: string, latestStatus: string, activeEpc: string): string {
  const request = text(printStatus, 'idle').toLowerCase(), history = text(latestStatus, 'idle').toLowerCase();
  if (activeEpc || request === 'processing' || history === 'processing') return 'processing';
  if (history === 'done' || request === 'done') return 'done';
  if (history === 'error' || request === 'error') return 'error';
  return 'idle';
}
/** @v2 buildPrinterEventKey */
export function buildPrinterEventKey(status: string, epc: string, error: string, printStatus: string): string {
  const state = derivePrinterState(printStatus, status, '');
  return state === 'idle' || state === 'processing' ? '' : `${state}|${text(epc)}|${text(error)}`;
}
/** @v2 buildPrinterEventMessage */
export function buildPrinterEventMessage(printStatus: string, status: string, epc: string, error: string, choice: string): string {
  const state = derivePrinterState(printStatus, status, ''), id = text(epc), reason = text(error);
  const printer = normalizePrinterChoice(choice);
  if (state === 'done') return id ? `${printer}: print qildi • ${id}` : `${printer}: print qildi`;
  if (state === 'error') return reason ? `${printer}: failed • ${reason}` : id ? `${printer}: failed • ${id}` : `${printer}: failed`;
  return '';
}

/** @v2 MonitorSnapshot */
export function emptyMonitorSnapshot() {
  return { scaleValue: '--', scaleCaption: 'Live qty', scaleStable: false, scaleConnectionLabel: 'Scale: ulanmagan',
    zebraValue: 'Idle', zebraCaption: 'Printer state', batchValue: 'Stopped', batchCaption: 'Ish oqimi',
    bridgeValue: 'Tayyor', bridgeCaption: 'Umumiy holat', serverLabel: 'API: idle',
    monitorLabel: 'Scale, Zebra, batch va print request holati', printerLabel: 'ulanmagan', printerKind: '', printerState: 'idle',
    printerEventKey: '', printerEventMessage: '', hasPrinterState: false, batchActive: false, batchItemCode: '', batchItemName: '',
    batchWarehouse: '', batchPrintMode: 'rfid', batchPrinter: 'zebra', batchQuantitySource: 'scale', batchManualQtyKg: 0,
    batchTareEnabled: false, batchTareKg: 0, batchLastError: '', batchLastErrorAt: '', latencyMs: 0 };
}
export type MonitorSnapshot = ReturnType<typeof emptyMonitorSnapshot>;

/** @v2 MonitorSnapshot.fromJson */
export function monitorSnapshotFromJson(json: Obj): MonitorSnapshot {
  const state = object(json.state), scale = object(state.scale), zebra = object(state.zebra), batch = object(state.batch), print = object(state.print_request);
  const nested = object(state.printer), top = object(json.printer), printer = Object.keys(nested).length ? nested : top;
  const connected = bool(printer.connected ?? printer.ok), batchActive = batch.active === true;
  const itemCode = text(batch.item_code), itemName = text(batch.item_name, itemCode), mode = text(batch.print_mode);
  const batchPrinter = normalizePrinterChoice(text(batch.printer)), status = text(print.status, 'idle');
  const epc = text(print.epc), error = text(print.error), stable = scale.stable === true;
  return { scaleValue: scale.weight == null ? '--' : `${String(scale.weight)} ${text(scale.unit, 'kg')}`,
    scaleCaption: stable ? 'stable' : 'live', scaleStable: stable,
    scaleConnectionLabel: buildScaleConnectionLabel(text(scale.source), text(scale.port), text(scale.error)),
    zebraValue: text(zebra.verify, 'idle').toUpperCase(), zebraCaption: text(zebra.action, 'printer state'),
    batchValue: batchActive ? 'Faol' : 'To‘xtagan', batchCaption: itemName || 'Ish oqimi',
    bridgeValue: status === 'idle' ? 'Tayyor' : status, bridgeCaption: text(print.epc, 'Umumiy holat'),
    serverLabel: text(json.ok, 'unknown') === 'true' ? 'API: onlayn' : 'API: oflayn',
    monitorLabel: itemName ? `Partiya: ${itemName}` : 'Faol partiya yo‘q',
    printerLabel: buildPrinterConnectionLabel(connected, text(printer.label)), printerKind: connected ? text(printer.kind) : '',
    printerState: derivePrinterState(status, status, status === 'processing' ? epc : ''),
    printerEventKey: buildPrinterEventKey(status, epc, error, status),
    printerEventMessage: buildPrinterEventMessage(status, status, epc, error, batchPrinter), hasPrinterState: !!Object.keys(printer).length,
    batchActive, batchItemCode: itemCode, batchItemName: itemName, batchWarehouse: text(batch.warehouse), batchPrintMode: mode,
    batchPrinter, batchQuantitySource: normalizeQuantitySource(text(batch.quantity_source)), batchManualQtyKg: number(batch.manual_qty_kg),
    batchTareEnabled: batch.tare === true, batchTareKg: number(batch.tare_kg), batchLastError: '', batchLastErrorAt: '', latencyMs: 0 };
}

/** @v2 MonitorSnapshot.copyWithBatch */
export function monitorSnapshotWithBatch(snapshot: MonitorSnapshot, batch: GScaleBatchSession): MonitorSnapshot {
  const name = batch.item_name || batch.item_code;
  return { ...snapshot, batchValue: batch.active ? 'Faol' : 'To‘xtagan', batchCaption: name || 'Ish oqimi',
    monitorLabel: name ? `Partiya: ${name}` : 'Faol partiya yo‘q', batchActive: batch.active, batchItemCode: batch.item_code,
    batchItemName: name, batchWarehouse: batch.warehouse,
    batchPrintMode: batch.active ? batch.print_mode || snapshot.batchPrintMode : snapshot.batchPrintMode,
    batchPrinter: batch.active ? batch.printer || snapshot.batchPrinter : snapshot.batchPrinter,
    batchQuantitySource: batch.active ? normalizeQuantitySource(batch.quantity_source) : snapshot.batchQuantitySource,
    batchManualQtyKg: batch.active ? batch.manual_qty_kg : snapshot.batchManualQtyKg,
    batchTareEnabled: batch.active ? batch.tare_enabled : snapshot.batchTareEnabled,
    batchTareKg: batch.active ? batch.tare_kg : snapshot.batchTareKg,
    batchLastError: batch.last_error, batchLastErrorAt: batch.last_error_at };
}

/** @v2 mergeLiveMonitorWithRsBatch */
export function mergeLiveMonitorWithRsBatch(live: MonitorSnapshot, previous: MonitorSnapshot): MonitorSnapshot {
  const monitor = live.hasPrinterState || !previous.hasPrinterState ? live : { ...live, printerLabel: previous.printerLabel,
    printerKind: previous.printerKind, printerState: previous.printerState, printerEventKey: previous.printerEventKey,
    printerEventMessage: previous.printerEventMessage, hasPrinterState: previous.hasPrinterState };
  if (!previous.batchActive || monitor.batchActive) return monitor;
  return { ...monitor, batchValue: 'Faol', batchCaption: previous.batchItemName || previous.batchItemCode || 'Ish oqimi',
    monitorLabel: previous.batchItemName || previous.batchItemCode ? `Partiya: ${previous.batchItemName || previous.batchItemCode}` : 'Faol partiya yo‘q',
    batchActive: true, batchItemCode: previous.batchItemCode, batchItemName: previous.batchItemName || previous.batchItemCode,
    batchWarehouse: previous.batchWarehouse, batchPrintMode: previous.batchPrintMode, batchPrinter: previous.batchPrinter,
    batchQuantitySource: previous.batchQuantitySource, batchManualQtyKg: previous.batchManualQtyKg,
    batchTareEnabled: previous.batchTareEnabled, batchTareKg: previous.batchTareKg, batchLastError: '', batchLastErrorAt: '' };
}
