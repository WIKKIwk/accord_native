import { isCanonicalApparatusId } from '../workerControlsApi';

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Json : null;
// Dart's Object.toString() is used by these V2 models, including for non-string values.
function dartString(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(dartString).join(', ')}]`;
  const map = object(value);
  if (map) return `{${Object.entries(map).map(([key, item]) => `${key}: ${dartString(item)}`).join(', ')}}`;
  return String(value);
}
const text = (value: unknown) => value == null ? '' : dartString(value);
function numericInteger(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite number');
  return Math.trunc(value);
}
const roles = new Set(['supplier', 'werka', 'customer', 'aparatchi', 'qolipchi', 'boyoqchi', 'tayyorlov_masteri',
  'material_taminotchi', 'admin', 'homashyo_rezkachi', 'sales_manager', 'brigader', 'rezka_master']);
function senderRole(value: unknown): string {
  const role = text(value).trim().toLowerCase();
  if (role === 'omborchi') return 'werka';
  if (!roles.has(role)) throw new TypeError(`Unsupported user role: ${text(value)}`);
  return role;
}
function list(value: unknown): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Expected a list');
  return value;
}

/** @v2 ReturnedPaintItemInput */
export type ReturnedPaintItem = { usage: string; category: string; name: string; values: Record<string, string> };
export function returnedPaintItemFromJson(json: Json): ReturnedPaintItem {
  const values = object(json.values);
  return { usage: text(json.usage), category: text(json.category), name: text(json.name),
    values: values ? Object.fromEntries(Object.entries(values).map(([key, value]) => [key, dartString(value)])) : {} };
}

/** @v2 ReturnedPaintSubmission */
export type ReturnedPaintSubmission = { order_id: string; order_code: string; order_name: string;
  apparatus: string; items: ReturnedPaintItem[]; image_id?: string };
export function returnedPaintSubmissionToJson(value: ReturnedPaintSubmission): Json {
  const image = (value.image_id ?? '').trim();
  return { order_id: value.order_id, order_code: value.order_code, order_name: value.order_name,
    apparatus: value.apparatus, ...(image ? { image_id: image } : {}), items: value.items };
}

/** @v2 ReturnedPaintCompleteSubmission */
export type ReturnedPaintCompleteSubmission = { request_id: string; items: ReturnedPaintItem[] };
export function returnedPaintCompleteToJson(value: ReturnedPaintCompleteSubmission): Json {
  return { request_id: value.request_id, items: value.items };
}

/** @v2 returnedPaintStatusFromJson */
export function returnedPaintStatusFromJson(value: unknown): 'waiting_for_boyoqchi_input' | 'completed' {
  return text(value).trim() === 'waiting_for_boyoqchi_input' ? 'waiting_for_boyoqchi_input' : 'completed';
}

/** @v2 ReturnedPaintImage */
export type ReturnedPaintImage = { image_id: string; image_name: string; image_mime: string; image_size_bytes: number; image_url: string };
export function returnedPaintImageFromJson(json: Json): ReturnedPaintImage {
  return { image_id: text(json.image_id), image_name: text(json.image_name), image_mime: text(json.image_mime),
    image_size_bytes: numericInteger(json.image_size_bytes), image_url: text(json.image_url) };
}

/** @v2 ReturnedPaintCalculation */
export type ReturnedPaintCalculation = { rasxot_mix_total: string; astatka_mix_total: string; rasxot_alcohol: string;
  astatka_alcohol: string; final_used_alcohol: string; rasxot_pure_paint: string; astatka_pure_paint: string; final_used_paint: string };
export function returnedPaintCalculationFromJson(json: Json): ReturnedPaintCalculation {
  const decimal = (key: string) => text(json[key]).trim();
  return { rasxot_mix_total: decimal('rasxot_mix_total'), astatka_mix_total: decimal('astatka_mix_total'),
    rasxot_alcohol: decimal('rasxot_alcohol'), astatka_alcohol: decimal('astatka_alcohol'),
    final_used_alcohol: decimal('final_used_alcohol'), rasxot_pure_paint: decimal('rasxot_pure_paint'),
    astatka_pure_paint: decimal('astatka_pure_paint'), final_used_paint: decimal('final_used_paint') };
}

/** @v2 ReturnedPaintRequest */
export type ReturnedPaintRequest = { id: string; order_id: string; order_code: string; order_name: string; apparatus: string;
  sender_role: string; sender_ref: string; sender_display_name: string; items: ReturnedPaintItem[]; created_at: Date;
  status: 'waiting_for_boyoqchi_input' | 'completed'; image: ReturnedPaintImage | null;
  calculation: ReturnedPaintCalculation | null; message: string };
export function returnedPaintRequestFromJson(json: Json): ReturnedPaintRequest {
  const apparatus = text(json.apparatus).trim();
  if (!isCanonicalApparatusId(apparatus)) throw new TypeError('Returned paint request requires canonical apparatus identity');
  const image = object(json.image), calculation = object(json.calculation);
  const created = new Date(numericInteger(json.created_at_unix) * 1000);
  if (!Number.isFinite(created.getTime())) throw new RangeError('Invalid returned paint date');
  return { id: text(json.id), order_id: text(json.order_id), order_code: text(json.order_code), order_name: text(json.order_name),
    apparatus, sender_role: senderRole(json.sender_role), sender_ref: text(json.sender_ref), sender_display_name: text(json.sender_display_name),
    status: returnedPaintStatusFromJson(json.status), message: text(json.message),
    items: list(json.items).flatMap(value => { const item = object(value); return item ? [returnedPaintItemFromJson(item)] : []; }),
    image: image ? returnedPaintImageFromJson(image) : null,
    calculation: calculation ? returnedPaintCalculationFromJson(calculation) : null, created_at: created };
}

/** @v2 ReturnedPaintRequestPage */
export type ReturnedPaintRequestPage = { items: ReturnedPaintRequest[]; has_more: boolean };
export function returnedPaintRequestPageFromJson(json: Json): ReturnedPaintRequestPage {
  return { items: list(json.items).flatMap(value => { const item = object(value); return item ? [returnedPaintRequestFromJson(item)] : []; }),
    has_more: json.has_more === true };
}

/** Dart double.tryParse accepts decimal and exponent syntax, but not JS's hexadecimal syntax. */
export function returnedPaintDouble(raw: string): number | null {
  const value = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** @v2 returnedPaintAstatkaTotal */
export function returnedPaintAstatkaTotal(items: readonly ReturnedPaintItem[]): number | null {
  if (!items.length) return null;
  let total = 0;
  for (const item of items) {
    if (item.usage.trim().toLowerCase() !== 'astatka') continue;
    for (const raw of Object.values(item.values)) {
      const value = returnedPaintDouble(raw);
      if (value === null) return null;
      total += value;
    }
  }
  return Number.isFinite(total) ? total : null;
}
