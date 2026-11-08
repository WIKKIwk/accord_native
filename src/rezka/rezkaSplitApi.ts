import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { currentRezkaScope, guardedRezkaRequest } from './rezkaSessionGuard';

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : null;
const text = (value: unknown, fallback = '') => value == null ? fallback : String(value).trim() || fallback;
function number(value: unknown): number {
  if (typeof value === 'number') return value;
  const raw = value == null ? '' : String(value).trim();
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(raw)) return 0;
  return Number(raw);
}

/** @v2 RezkaSourceEntry */
export type RezkaSource = { barcode: string; stock_entry_name: string; line_index: number; item_code: string; item_name: string;
  qty: number; uom: string; warehouse: string; company: string };
/** @v2 RezkaOutputLabel */
export type RezkaOutput = { epc: string; item_code: string; item_name: string; qty: number; uom: string; warehouse: string;
  reason: string; print_qr: boolean };
/** @v2 RezkaSplitOutputRequest */
export type RezkaOutputRequest = { epc?: string; item_code: string; item_name: string; qty: number; uom: string;
  target_warehouse: string; reason: string; print_qr?: boolean };
/** @v2 RezkaSplitRequest */
export type RezkaSplitInput = { source_barcode: string; source_stock_entry: string; source_line_index: number; reason: string;
  driver_url: string; printer: string; print_mode: string; outputs: RezkaOutputRequest[] };
/** @v2 RezkaSourceResponse */
export type RezkaSourceResponse = { ok: boolean; source: RezkaSource };
/** @v2 RezkaSplitResponse */
export type RezkaSplitResponse = { ok: boolean; status: string; stock_entry_name: string; source_barcode: string; outputs: RezkaOutput[] };

export function sourceFromJson(raw: unknown): RezkaSource {
  const row = object(raw) ?? {};
  const line = number(row.line_index);
  if (!Number.isFinite(line)) throw new RangeError('Invalid line index');
  return { barcode: text(row.barcode), stock_entry_name: text(row.stock_entry_name), line_index: Math.trunc(line),
    item_code: text(row.item_code), item_name: text(row.item_name), qty: number(row.qty), uom: text(row.uom),
    warehouse: text(row.warehouse), company: text(row.company) };
}
export function outputFromJson(raw: unknown): RezkaOutput {
  const row = object(raw) ?? {};
  return { epc: text(row.epc), item_code: text(row.item_code), item_name: text(row.item_name), qty: number(row.qty),
    uom: text(row.uom), warehouse: text(row.warehouse), reason: text(row.reason), print_qr: row.print_qr !== false };
}
export function splitResponseFromJson(row: Json): RezkaSplitResponse {
  return { ok: row.ok === true, status: text(row.status), stock_entry_name: text(row.stock_entry_name), source_barcode: text(row.source_barcode),
    outputs: Array.isArray(row.outputs) ? row.outputs.filter(item => !!object(item)).map(outputFromJson) : [] };
}
export function splitRequestToJson(input: RezkaSplitInput): Json {
  return { source_barcode: input.source_barcode.trim(), source_stock_entry: input.source_stock_entry.trim(),
    source_line_index: input.source_line_index, reason: input.reason.trim(), driver_url: input.driver_url.trim().replace(/\/+$/, ''),
    printer: input.printer.trim(), print_mode: input.print_mode.trim(), outputs: input.outputs.map(output => ({
      ...(output.epc?.trim() ? { epc: output.epc.trim() } : {}), item_code: output.item_code.trim(), item_name: output.item_name.trim(),
      qty: output.qty, uom: output.uom.trim(), target_warehouse: output.target_warehouse.trim(), reason: output.reason.trim(),
      print_qr: output.print_qr !== false,
    })) };
}
export function withPreparedOutputs(input: RezkaSplitInput, prepared: readonly RezkaOutput[]): RezkaSplitInput {
  if (prepared.length !== input.outputs.length) throw new Error('Rezka prepared output count mismatch');
  return { ...input, outputs: input.outputs.map((output, index) => ({ ...output, epc: prepared[index].epc })) };
}
async function decode(response: Response, fallbackCode: string, fallbackMessage: string): Promise<Json> {
  let body: Json = {};
  try { body = object(await response.json()) ?? {}; } catch { /* V2 falls back to an empty object. */ }
  if (response.status !== 200) throw new MobileApiException({ code: text(body.error, fallbackCode),
    message: text(body.detail, text(body.message, fallbackMessage)), statusCode: response.status });
  return body;
}
/** @v2 rezkaSource */
export async function rezkaSource(session: Session, barcode: string, expectedScope = currentRezkaScope(session)): Promise<RezkaSourceResponse> {
  const query = new URLSearchParams({ barcode: barcode.trim() });
  const response = await guardedRezkaRequest(session, 'split', expectedScope, false, beforeSend =>
    authorizedFetch(session, `/v1/mobile/rezka/source?${query}`, {}, beforeSend));
  const row = await decode(response, 'rezka_source_failed', 'Rezka source failed');
  if (row.source != null && !object(row.source)) throw new TypeError('Invalid source');
  return { ok: row.ok === true, source: sourceFromJson(row.source) };
}
async function split(session: Session, path: string, request: RezkaSplitInput, expectedScope: string): Promise<RezkaSplitResponse> {
  const body = splitRequestToJson(request);
  if (request.outputs.some(output => !Number.isFinite(output.qty))) throw new TypeError('Non-finite quantity');
  const response = await guardedRezkaRequest(session, 'split', expectedScope, true, beforeSend =>
    authorizedFetch(session, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, beforeSend));
  return splitResponseFromJson(await decode(response, 'rezka_split_failed', 'Rezka split failed'));
}
/** @v2 rezkaSplit */
export function rezkaSplit(session: Session, request: RezkaSplitInput, expectedScope = currentRezkaScope(session)): Promise<RezkaSplitResponse> {
  return split(session, '/v1/mobile/rezka/split', request, expectedScope);
}
/** @v2 rezkaSplitClientPrintPrepare */
export function rezkaSplitClientPrintPrepare(session: Session, request: RezkaSplitInput, expectedScope = currentRezkaScope(session)): Promise<RezkaSplitResponse> {
  return split(session, '/v1/mobile/rezka/split/client-print/prepare', request, expectedScope);
}
/** @v2 rezkaSplitClientPrintConfirm */
export function rezkaSplitClientPrintConfirm(session: Session, request: RezkaSplitInput, expectedScope = currentRezkaScope(session)): Promise<RezkaSplitResponse> {
  return split(session, '/v1/mobile/rezka/split/client-print/confirm', request, expectedScope);
}
