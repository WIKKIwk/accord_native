import { UsbRpsPrintRequest } from '../printing/printModels';
import type { RawMaterialReprint } from '../shared/printApi';
import { MobileApiException } from '../shared/mobileApiException';
import { buildMaterialReceiptReprintRequest } from './gscaleControlLogic';
import { formatCompactKg } from './gscalePreparation';
import type { GScaleBatchSession } from './gscaleBatchModel';

export type ArchivePrintEntry = { item_code: string; item_name: string; qty: number; net_qty: number; gross_qty: number;
  unit: string; printed_at: string; draft_name: string; epc: string; status: string; printer: string; print_mode: string };
export type ArchiveSession = { session_id: string; batch_code: string; active: boolean; item_code: string; item_name: string;
  warehouse: string; started_at: string; ended_at: string; total_qty: number; gross_qty: number; net_qty: number; unit: string;
  tare_enabled: boolean; tare_kg: number; print_count: number; prints: ArchivePrintEntry[]; preparation_formula: Record<string, unknown> };

const text = (value: unknown, fallback = '') => value == null || !String(value).trim() ? fallback : String(value).trim();
function numeric(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid archive number');
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid archive object');
  return value as Record<string, unknown>;
}

/** @v2 MobileArchivePrintEntry */
export function archivePrintEntryFromJson(value: unknown): ArchivePrintEntry {
  const row = object(value), qty = numeric(row.qty), net = numeric(row.net_qty, qty), gross = numeric(row.gross_qty, net);
  return { item_code: text(row.item_code), item_name: text(row.item_name), qty, net_qty: net, gross_qty: gross,
    unit: text(row.unit, 'kg'), printed_at: text(row.printed_at), draft_name: text(row.draft_name), epc: text(row.epc),
    status: text(row.status), printer: text(row.printer), print_mode: text(row.print_mode) };
}

/** @v2 MobileArchiveSession */
export function archiveSessionFromJson(value: unknown): ArchiveSession {
  const row = object(value);
  if (row.prints != null && !Array.isArray(row.prints)) throw new TypeError('Invalid archive prints');
  const prints = ((row.prints ?? []) as unknown[]).map(archivePrintEntryFromJson);
  return { session_id: text(row.session_id), batch_code: text(row.batch_code), active: row.active === true,
    item_code: text(row.item_code), item_name: text(row.item_name), warehouse: text(row.warehouse),
    started_at: text(row.started_at), ended_at: text(row.ended_at), total_qty: numeric(row.total_qty),
    gross_qty: numeric(row.gross_qty), net_qty: numeric(row.net_qty), unit: text(row.unit, 'kg'),
    tare_enabled: row.tare_enabled === true, tare_kg: numeric(row.tare_kg),
    print_count: Math.trunc(numeric(row.print_count, prints.length)), prints, preparation_formula: {} };
}

/** @v2 formatArchiveTimestamp */
export function formatArchiveTimestamp(raw: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const parsed = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(parsed.getDate())} ${months[parsed.getMonth()]} ${two(parsed.getHours())}:${two(parsed.getMinutes())}`;
}

/** @v2 MobileArchiveSession.fromRpsBatch */
export function archiveSessionFromBatch(batch: GScaleBatchSession): ArchiveSession {
  const prints = batch.prints.map(value => ({ ...value, item_code: batch.item_code, item_name: batch.item_name }));
  const net = prints.reduce((sum, value) => sum + (value.net_qty > 0 ? value.net_qty : value.qty), 0);
  const gross = prints.reduce((sum, value) => sum + (value.gross_qty > 0 ? value.gross_qty : value.net_qty), 0);
  return { session_id: batch.id, batch_code: batch.batch_code, active: batch.active, item_code: batch.item_code,
    item_name: batch.item_name, warehouse: batch.warehouse, started_at: batch.created_at, ended_at: batch.active ? '' : batch.updated_at,
    total_qty: net, gross_qty: gross, net_qty: net, unit: prints[0]?.unit ?? 'kg', tare_enabled: batch.tare_enabled,
    tare_kg: batch.tare_kg, print_count: prints.length, prints, preparation_formula: batch.preparation_formula };
}

export type MaterialBatchPrintPlan = { qr_payload: string; item_code: string; label_title: string; warehouse: string;
  gross_qty: number; net_qty: number; unit: string };

/** @v2 buildMaterialBatchPrintPlan */
export function buildMaterialBatchPrintPlan(session: ArchiveSession): MaterialBatchPrintPlan {
  const id = session.session_id.trim();
  if (!id) throw new Error('Partiya identifikatori topilmadi');
  const itemCode = session.item_code.trim() || session.prints[0]?.item_code.trim() || '';
  if (!itemCode) throw new Error('Partiya mahsulot kodi topilmadi');
  const warehouse = session.warehouse.trim();
  if (!warehouse) throw new Error('Partiya ombori topilmadi');
  const net = session.net_qty > 0 ? session.net_qty : session.total_qty;
  const gross = session.gross_qty > 0 ? session.gross_qty : net;
  if (!Number.isFinite(gross) || !Number.isFinite(net) || gross <= 0 || net <= 0) throw new Error('Partiya miqdori noto‘g‘ri');
  const unit = session.unit || 'kg', name = (session.item_name || session.item_code).trim() || itemCode;
  const code = session.batch_code.trim().toUpperCase();
  if (code && !/^42[0-9A-F]{22}$/.test(code)) throw new Error('Partiya kodi noto‘g‘ri');
  return { qr_payload: `RPS-BATCH:${code || id.toUpperCase()}`, item_code: itemCode,
    label_title: `${name}  B:${formatCompactKg(gross)} N:${formatCompactKg(net)} ${unit}`,
    warehouse, gross_qty: gross, net_qty: net, unit };
}

/** @v2 MaterialBatchPrintPlan */
export function materialBatchDriverRequest(plan: MaterialBatchPrintPlan, printer: string) {
  const tare = Math.max(0, plan.gross_qty - plan.net_qty);
  return { epc: plan.qr_payload, item_code: plan.item_code, item_name: plan.label_title, warehouse: plan.warehouse,
    printer, print_mode: 'label', label_kind: 'qolip_code', gross_qty: plan.gross_qty, unit: plan.unit,
    tare_enabled: tare > 0, tare_kg: tare, print_count: 1 };
}
export function materialBatchUsbRequest(plan: MaterialBatchPrintPlan, printer: string): UsbRpsPrintRequest {
  const tare = Math.max(0, plan.gross_qty - plan.net_qty);
  return new UsbRpsPrintRequest({ epc: plan.qr_payload, itemCode: plan.item_code, itemName: plan.label_title,
    warehouse: plan.warehouse, printer, printMode: 'label', grossQty: plan.gross_qty, unit: plan.unit,
    tareEnabled: tare > 0, tareKg: tare, labelKind: 'qolip_code' });
}

/** @v2 _reprintArchiveReceipt */
export async function reprintArchiveReceipt(entry: ArchivePrintEntry, printer: string, deps: {
  prepare(epc: string): Promise<RawMaterialReprint>;
  print(request: UsbRpsPrintRequest): Promise<{ ok: boolean }>;
  confirm(barcode: string, reprintId: string): Promise<void>;
}): Promise<string | null> {
  const prepared = await deps.prepare(entry.epc);
  const expected = entry.epc.trim().toUpperCase();
  if (!prepared.reprint_id.trim() || prepared.stock.barcode.trim().toUpperCase() !== expected ||
      prepared.print_request.epc.trim().toUpperCase() !== expected) {
    throw new MobileApiException({ code: 'raw_material_stock_reprint_identity_mismatch', message: 'Serverdagi QR identifikatori mos kelmadi' });
  }
  if (!printer) throw new Error('Printer ulanmagan');
  const result = await deps.print(buildMaterialReceiptReprintRequest(prepared, entry, printer));
  if (!result.ok) throw new Error('Printer QR kodini chop etmadi');
  try { await deps.confirm(prepared.stock.barcode, prepared.reprint_id); return null; }
  catch { return 'QR chop etildi, lekin server tasdig‘i saqlanmadi'; }
}
