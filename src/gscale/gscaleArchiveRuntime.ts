import type { Session } from '../auth';
import { PrintService } from '../printing/printService';
import type { PrintTransport } from '../printing/printTransport';
import { adminConfirmRawMaterialStockReprint, adminPrepareRawMaterialStockReprint } from '../shared/printApi';
import { archiveSessionFromBatch, archiveSessionFromJson, buildMaterialBatchPrintPlan, materialBatchDriverRequest,
  materialBatchUsbRequest, reprintArchiveReceipt, type ArchivePrintEntry, type ArchiveSession } from './gscaleArchive';
import { gscaleRpsBatchHistory } from './gscaleBatchApi';
import { normalizePrinterChoice } from './gscaleControlLogic';
import type { DiscoveredServer } from './gscaleDiscovery';
import type { MonitorSnapshot } from './gscaleMonitor';
import type { PrintDeviceSelection } from './gscalePreferences';

export type GScaleArchiveContext = { controlOnly: boolean; transport: PrintTransport; selection: PrintDeviceSelection | null;
  server: DiscoveredServer | null; monitor: MonitorSnapshot; batchPrinter: string };
async function timed<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), milliseconds); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function request(server: DiscoveredServer | null, path: string, init: RequestInit, timeout: number) {
  if (!server) throw new Error('Avval printer yoki tarozini tanlang');
  return timed((async () => {
    const response = await fetch(`${server.endpoint.baseUrl}${path}`, init);
    const body = await response.text();
    return { status: response.status, body };
  })(), timeout);
}
function parseObject(body: string): Record<string, unknown> {
  try { const value: unknown = JSON.parse(body); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  catch { return {}; }
}

/** @v2 _currentArchivePrinterChoice */
export function currentArchivePrinterChoice(context: GScaleArchiveContext): string {
  if (context.transport === 'bluetooth') return context.selection?.transport === 'bluetooth' ? context.selection.bluetoothPrinter.printer : 'xp-p323b';
  if (context.transport === 'offline') return context.selection?.transport === 'offline' ? context.selection.offlinePrinter.printer : 'godex';
  const kind = context.monitor.printerKind.trim().toLowerCase(), label = context.monitor.printerLabel.trim().toLowerCase();
  if (kind === 'zebra' || kind === 'godex') return kind;
  if (label.startsWith('zebra')) return 'zebra';
  if (label.startsWith('godex') || label.startsWith('go-dex')) return 'godex';
  if (label === 'ulanmagan') return '';
  return normalizePrinterChoice(context.batchPrinter);
}

/** @v2 _refreshArchive */
export async function loadGScaleArchive(session: Session, context: GScaleArchiveContext): Promise<ArchiveSession[]> {
  if (context.controlOnly) return (await timed(gscaleRpsBatchHistory(session, 50), 15000)).map(archiveSessionFromBatch);
  const response = await request(context.server, '/v1/mobile/archive?limit=50', {}, 4000);
  if (response.status < 200 || response.status > 299) throw new Error(`archive ${response.status}`);
  const payload: unknown = JSON.parse(response.body);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Invalid archive response');
  const values = (payload as Record<string, unknown>).archive;
  if (values == null) return [];
  if (!Array.isArray(values)) throw new TypeError('Invalid archive list');
  return values.map(archiveSessionFromJson);
}

/** @v2 _printArchiveSession */
export async function printGScaleArchiveSession(context: GScaleArchiveContext, session: ArchiveSession): Promise<string> {
  const printer = currentArchivePrinterChoice(context);
  if (!printer) throw new Error('Printer ulanmagan');
  const local = context.transport !== 'wifi';
  const plan = context.controlOnly || local ? buildMaterialBatchPrintPlan(session) : null;
  const name = session.item_name || session.item_code || 'Partiya';
  if (local) {
    await PrintService.printRps(materialBatchUsbRequest(plan!, printer), { transport: context.transport,
      printerProfile: context.selection?.transport === 'offline' ? context.selection.offlinePrinter : null,
      bluetoothPrinter: context.selection?.transport === 'bluetooth' ? context.selection.bluetoothPrinter : null });
    return `${name} ${context.transport === 'bluetooth' ? 'Bluetooth' : 'USB'} printerda chop etildi`;
  }
  const body = context.controlOnly ? materialBatchDriverRequest(plan!, printer) : { session_id: session.session_id, printer };
  const response = await request(context.server, context.controlOnly ? '/v1/mobile/driver/print' : '/v1/mobile/archive/print', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, 5000);
  if (response.status < 200 || response.status > 299) {
    const payload = parseObject(response.body);
    throw new Error(String(payload.error || 'Arxiv chop etish muvaffaqiyatsiz'));
  }
  return `${name} uchun QR chop etish yuborildi`;
}

export function reprintGScaleArchiveReceipt(session: Session, context: GScaleArchiveContext, entry: ArchivePrintEntry): Promise<string | null> {
  const printer = currentArchivePrinterChoice(context);
  return reprintArchiveReceipt(entry, printer, {
    prepare: epc => adminPrepareRawMaterialStockReprint(session, epc),
    confirm: (barcode, id) => adminConfirmRawMaterialStockReprint(session, barcode, id),
    print: async label => {
      if (context.transport !== 'wifi') return PrintService.printRps(label, { transport: context.transport,
        printerProfile: context.selection?.transport === 'offline' ? context.selection.offlinePrinter : null,
        bluetoothPrinter: context.selection?.transport === 'bluetooth' ? context.selection.bluetoothPrinter : null });
      const response = await request(context.server, '/v1/mobile/driver/print', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(label.toJson()),
      }, 15000);
      const payload = parseObject(response.body);
      if (response.status < 200 || response.status > 299 || payload.ok !== true) {
        throw new Error(String(payload.detail || payload.error || 'Printer QR kodini chop etmadi'));
      }
      return { ok: true };
    },
  });
}
