import type { Session } from '../auth';
import type { BluetoothPrinterProfile } from '../printing/nativePrinter';
import { UsbPrinterProfile, UsbRpsPrintRequest } from '../printing/printModels';
import { PrintService } from '../printing/printService';
import { SessionBluetoothPrinter } from '../printing/sessionBluetoothPrinter';
import type { WorkerPrintJob } from '../workerPrintJob';
import type { preparationProductionRollFromJson } from './preparationProductionModel';
import { reprintPreparationRoll } from './preparationReprint';

export type PreparationDeviceSelection = { transport: 'offline'; printer: UsbPrinterProfile } |
  { transport: 'bluetooth'; printer: BluetoothPrinterProfile } | { transport: 'wifi'; serverBaseUrl: string };
type Printer = PreparationDeviceSelection | { transport: 'wifi'; serverBaseUrl: string; printer: string; printMode: string };
type ConnectedWifiPrinter = Extract<Printer, { printer: string }>;
const text = (value: unknown, fallback = '') => value == null ? fallback : String(value).trim() || fallback;
const truthy = (value: unknown) => value === true || (typeof value === 'number' && value !== 0) ||
  (typeof value === 'string' && ['true', '1', 'yes'].includes(value.trim().toLowerCase()));

/** @v2 parseServerEndpoint */
export function preparationPrinterServerUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Manzil formati noto‘g‘ri');
  let url: URL;
  try { url = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`); }
  catch { throw new Error('Manzil formati noto‘g‘ri'); }
  if (!url.hostname || !['http:', 'https:'].includes(url.protocol)) throw new Error('Manzil formati noto‘g‘ri');
  if (['localhost', '127.0.0.1', '::1', '[::1]', '10.0.2.2'].includes(url.hostname.toLowerCase()))
    throw new Error('Localhost emas, Wi‑Fi server manzilini kiriting');
  return `${url.protocol}//${url.hostname}:${url.port || '39117'}`;
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeout: number): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, payload: await response.json() };
  }
  finally { clearTimeout(timer); }
}

/** @v2 pickProgressPrinter */
export async function pickPreparationPrinter(options: {
  isCurrent: () => boolean; selectDevice: () => Promise<PreparationDeviceSelection | null>;
}): Promise<Printer | null> {
  const cached = await SessionBluetoothPrinter.resolveCached();
  if (cached) return { transport: 'bluetooth', printer: cached };
  if (!options.isCurrent()) return null;
  const selection = await options.selectDevice();
  if (!selection) return null;
  if (selection.transport === 'bluetooth') { SessionBluetoothPrinter.remember(selection.printer); return selection; }
  if (selection.transport === 'offline') return selection;
  try {
    const baseUrl = selection.serverBaseUrl.replace(/\/+$/, '');
    const { response, payload } = await fetchJsonWithTimeout(`${baseUrl}/v1/mobile/monitor/state`, {}, 2000);
    if (!response.ok) return null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const raw = payload as Record<string, unknown>, state = raw.state;
    const nested = state && typeof state === 'object' && !Array.isArray(state) ? (state as Record<string, unknown>).printer : null;
    const printer = raw.printer ?? nested;
    if (!printer || typeof printer !== 'object' || Array.isArray(printer)) return null;
    const value = printer as Record<string, unknown>;
    if (!truthy(value.connected) && !truthy(value.ok)) return null;
    const kind = text(value.kind, 'printer');
    return { transport: 'wifi', serverBaseUrl: baseUrl, printer: kind,
      printMode: kind.toLowerCase() === 'godex' ? 'label' : 'rfid' };
  } catch { return null; }
}

/** @v2 _InventoryAssetQrSheetState */
export async function pickPreparationInventoryPrinter(options: {
  isCurrent: () => boolean; selectDevice: () => Promise<PreparationDeviceSelection | null>;
}): Promise<Printer | null> {
  const cached = await SessionBluetoothPrinter.resolveCached();
  if (cached) return { transport: 'bluetooth', printer: cached };
  if (!options.isCurrent()) return null;
  const selection = await options.selectDevice();
  if (!selection) return null;
  if (selection.transport === 'bluetooth') SessionBluetoothPrinter.remember(selection.printer);
  return selection.transport === 'wifi' ? { ...selection, printer: '', printMode: '' } : selection;
}

export async function printPreparationJob(job: WorkerPrintJob, printer: Printer, options: { inventory?: boolean } = {}): Promise<boolean> {
  const request = UsbRpsPrintRequest.fromPrintJson(job);
  if (printer.transport === 'offline' || printer.transport === 'bluetooth') {
    const result = await PrintService.printRps(request, printer.transport === 'offline'
      ? { transport: 'offline', printerProfile: printer.printer }
      : { transport: 'bluetooth', bluetoothPrinter: printer.printer });
    return result.ok;
  }
  if (!('printer' in printer)) throw new Error('Printer serveri tanlanmadi');
  const selected: ConnectedWifiPrinter = printer;
  const { response, payload } = await fetchJsonWithTimeout(`${selected.serverBaseUrl}/v1/mobile/driver/print`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request.toJson(), ...(!options.inventory && selected.printer ? { printer: selected.printer } : {}),
      ...(!options.inventory && selected.printMode ? { print_mode: selected.printMode } : {}) }),
  }, 15000);
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  if (!response.ok || body?.ok !== true) throw new Error(text(body?.detail ?? body?.error, 'Printer QR kodini chop etmadi'));
  return true;
}

export function reprintPreparationRollWithPrinter(session: Session, roll: ReturnType<typeof preparationProductionRollFromJson>,
  orderId: string, options: { isCurrent: () => boolean; selectDevice: () => Promise<PreparationDeviceSelection | null> }) {
  return reprintPreparationRoll(session, roll, orderId, {
    isCurrent: options.isCurrent, pickPrinter: () => pickPreparationPrinter(options), print: printPreparationJob,
  });
}
