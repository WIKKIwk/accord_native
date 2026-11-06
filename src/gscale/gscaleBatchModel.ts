export type GScaleBatchStart = {
  client_batch_id: string; preparation_formula_material_id?: string; preparation_formula_variant_id?: string;
  order_id?: string; apparatus?: string; driver_url: string; item_code: string; item_name: string; warehouse: string;
  printer: string; print_mode: string; quantity_source: string; manual_qty_kg?: number; tare_enabled?: boolean;
  tare_kg?: number; width_mm?: number | null; micron?: number | null; length_m?: number | null;
};
export type GScaleBatchUpdate = {
  batch_id: string; expected_revision: number; order_id?: string; apparatus?: string;
  item_code: string; item_name: string; warehouse: string; quantity_source?: string; tare_enabled?: boolean;
  tare_kg?: number; width_mm?: number | null; micron?: number | null; length_m?: number | null;
};
export type GScaleBatchPrint = {
  batch_id: string; expected_revision: number; expected_item_code: string; expected_warehouse: string;
  gross_qty: number; driver_url: string; unit?: string; print_count?: number;
};
const trimmed = (value?: string) => (value ?? '').trim();
const cleanUrl = (value: string) => value.trim().replace(/\/+$/, '');
const optionalDimensions = (request: { width_mm?: number | null; micron?: number | null; length_m?: number | null }) => ({
  ...(request.width_mm != null ? { width_mm: request.width_mm } : {}),
  ...(request.micron != null ? { micron: request.micron } : {}),
  ...(request.length_m != null ? { length_m: request.length_m } : {}),
});

/** @v2 GScaleRpsBatchStartRequest */
export function batchStartBody(request: GScaleBatchStart) {
  const material = trimmed(request.preparation_formula_material_id), variant = trimmed(request.preparation_formula_variant_id);
  const order = trimmed(request.order_id), apparatus = trimmed(request.apparatus);
  return { client_batch_id: request.client_batch_id.trim(),
    ...(material ? { preparation_formula: { material_id: material, variant_id: variant } } : {}),
    ...(order ? { order_id: order } : {}), ...(apparatus ? { apparatus } : {}), driver_url: cleanUrl(request.driver_url),
    item_code: request.item_code.trim(), item_name: request.item_name.trim(), warehouse: request.warehouse.trim(),
    printer: request.printer.trim(), print_mode: request.print_mode.trim(), quantity_source: request.quantity_source.trim(),
    manual_qty_kg: request.manual_qty_kg ?? 0, tare_enabled: request.tare_enabled ?? false, tare_kg: request.tare_kg ?? 0,
    ...optionalDimensions(request) };
}

/** @v2 GScaleRpsBatchUpdateRequest */
export function batchUpdateBody(request: GScaleBatchUpdate) {
  const order = trimmed(request.order_id), apparatus = trimmed(request.apparatus);
  return { batch_id: request.batch_id.trim(), ...(order ? { order_id: order } : {}), ...(apparatus ? { apparatus } : {}),
    expected_revision: request.expected_revision, item_code: request.item_code.trim(), item_name: request.item_name.trim(),
    warehouse: request.warehouse.trim(), ...optionalDimensions(request),
    quantity_source: trimmed(request.quantity_source).toLowerCase() === 'manual' ? 'manual' : 'scale',
    tare_enabled: request.tare_enabled ?? false, tare_kg: request.tare_kg ?? 0 };
}

/** @v2 GScaleRpsBatchStopRequest */
export function batchStopBody(batchId: string, expectedRevision: number) {
  return { batch_id: batchId.trim(), expected_revision: expectedRevision };
}

/** @v2 GScaleRpsBatchPrintRequest */
export function batchPrintBody(request: GScaleBatchPrint) {
  const count = request.print_count ?? 1;
  return { batch_id: request.batch_id.trim(), expected_revision: request.expected_revision,
    expected_item_code: request.expected_item_code.trim(), expected_warehouse: request.expected_warehouse.trim(),
    gross_qty: request.gross_qty, unit: trimmed(request.unit) || 'kg', driver_url: cleanUrl(request.driver_url),
    print_count: count > 1 ? count : 1 };
}

type Obj = Record<string, unknown>;
function obj(value: unknown): Obj {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid GScale object');
  return value as Obj;
}
function text(value: unknown, fallback = '') { const result = value == null ? '' : String(value).trim(); return result || fallback; }
function number(value: unknown): number {
  if (typeof value === 'number') return value;
  const raw = text(value);
  if (!raw || !/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(raw)) return 0;
  return Number(raw);
}
function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const result = number(value);
  return Number.isFinite(result) && result > 0 ? result : null;
}
function integer(value: unknown, fallback: number) {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid GScale integer');
  return Math.trunc(value);
}
function list(value: unknown): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid GScale list');
  return value;
}

/** @v2 GScaleRpsBatchPrintEntry */
export function batchPrintEntryFromJson(value: unknown) {
  const j = obj(value);
  return { epc: text(j.epc), draft_name: text(j.draft_name), status: text(j.status), qty: number(j.qty),
    net_qty: number(j.net_qty), gross_qty: number(j.gross_qty), unit: text(j.unit, 'kg'), printer: text(j.printer),
    print_mode: text(j.print_mode), print_count: integer(j.print_count, 1), printed_at: text(j.printed_at) };
}

/** @v2 GScaleRpsBatchSession */
export function batchSessionFromJson(value: unknown) {
  const j = obj(value), assignment = obj(j.order_assignment);
  return { order_id: text(assignment.order_id), apparatus: text(assignment.apparatus),
    preparation_formula: obj(assignment.preparation_formula), id: text(j.id), batch_code: text(j.batch_code),
    revision: integer(j.revision, 0), active: j.active === true, driver_url: text(j.driver_url), item_code: text(j.item_code),
    item_name: text(j.item_name), warehouse: text(j.warehouse), printer: text(j.printer), print_mode: text(j.print_mode),
    quantity_source: text(j.quantity_source, 'scale'), manual_qty_kg: number(j.manual_qty_kg),
    tare_enabled: j.tare_enabled === true || j.tare === true, tare_kg: number(j.tare_kg), width_mm: optionalNumber(j.width_mm),
    micron: optionalNumber(j.micron), length_m: optionalNumber(j.length_m), last_error: text(j.last_error),
    last_error_at: text(j.last_error_at), created_at: text(j.created_at), updated_at: text(j.updated_at),
    prints: list(j.prints).filter(value => value != null && typeof value === 'object' && !Array.isArray(value)).map(batchPrintEntryFromJson) };
}
export type GScaleBatchSession = ReturnType<typeof batchSessionFromJson>;

/** @v2 GScaleRpsBatchResponse */
export function batchResponseFromJson(value: unknown) {
  const json = obj(value);
  return { ok: json.ok === true, batch: batchSessionFromJson(json.batch) };
}

/** @v2 GScaleMaterialReceiptPrintResponse */
export function materialReceiptPrintResponseFromJson(value: unknown) {
  const j = obj(value);
  return { ok: j.ok === true, status: text(j.status), draft_name: text(j.draft_name), epc: text(j.epc), item_code: text(j.item_code),
    item_name: text(j.item_name), warehouse: text(j.warehouse), qty: number(j.qty), net_qty: number(j.net_qty),
    gross_qty: number(j.gross_qty), width_mm: optionalNumber(j.width_mm), micron: optionalNumber(j.micron),
    length_m: optionalNumber(j.length_m), unit: text(j.unit, 'kg'), printer: text(j.printer), print_mode: text(j.print_mode),
    printer_status: text(j.printer_status), print_count: integer(j.print_count, 1) };
}
