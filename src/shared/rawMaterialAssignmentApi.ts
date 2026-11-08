import type { Session } from '../auth';
import { readApparatus } from '../apparatusApi';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from '../workerControlsApi';
import { MobileApiException } from './mobileApiException';

type Obj = Record<string, unknown>;
const object = (raw: unknown): Obj => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid raw material assignment data');
  return raw as Obj;
};
const text = (raw: unknown) => raw == null ? '' : String(raw);
const number = (raw: unknown): number | null => {
  if (raw == null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new TypeError('Invalid raw material assignment number');
  return raw;
};
function apparatusId(raw: string, allowEmpty = false): string {
  const value = raw.trim();
  if ((!value && allowEmpty) || isCanonicalApparatusId(value)) return value;
  throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
}
function apparatusList(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID ro‘yxati noto‘g‘ri');
  return [...new Set(raw.map(value => apparatusId(text(value))))];
}

/** @v2 AdminRawMaterialAssignmentCandidate */
export type RawMaterialAssignmentCandidate = { barcode: string; warehouse: string; item_code: string; item_name: string;
  item_group: string; qty: number; uom: string; apparatus_options: string[]; order_width_mm: number | null;
  roll_width_mm: number | null; leftover_width_mm: number | null; match_type: string };
export function rawMaterialAssignmentCandidate(raw: unknown): RawMaterialAssignmentCandidate {
  const row = object(raw), match = text(row.match_type).trim();
  return { barcode: text(row.barcode), warehouse: text(row.warehouse), item_code: text(row.item_code), item_name: text(row.item_name),
    item_group: text(row.item_group), qty: number(row.qty) ?? 0, uom: text(row.uom), apparatus_options: apparatusList(row.apparatus_options),
    order_width_mm: number(row.order_width_mm), roll_width_mm: number(row.roll_width_mm), leftover_width_mm: number(row.leftover_width_mm),
    match_type: match || 'compatible' };
}

/** @v2 AdminRawMaterialAssignmentDiagnostic */
export type RawMaterialAssignmentDiagnostic = { barcode: string; compatible: boolean; reason: string; item_code: string;
  item_name: string; item_group: string; warehouse: string; stock_status: string; reserved_order_id: string; apparatus_options: string[];
  order_id: string; order_title: string; apparatus: string; order_width_mm: number | null; roll_width_mm: number | null;
  minimum_width_mm: number | null; maximum_width_mm: number | null };
export function rawMaterialAssignmentDiagnostic(raw: unknown): RawMaterialAssignmentDiagnostic {
  const row = object(raw);
  return { barcode: text(row.barcode), compatible: row.compatible === true, reason: text(row.reason).trim(),
    item_code: text(row.item_code), item_name: text(row.item_name), item_group: text(row.item_group), warehouse: text(row.warehouse),
    stock_status: text(row.stock_status), reserved_order_id: text(row.reserved_order_id), apparatus_options: apparatusList(row.apparatus_options),
    order_id: text(row.order_id), order_title: text(row.order_title), apparatus: text(row.apparatus),
    order_width_mm: number(row.order_width_mm), roll_width_mm: number(row.roll_width_mm),
    minimum_width_mm: number(row.minimum_width_mm), maximum_width_mm: number(row.maximum_width_mm) };
}

async function read(session: Session, path: string, fallback: string): Promise<unknown> {
  // V2 uses an ordinary GET here, without transient retries.
  await Promise.resolve();
  const { response, body } = await readApparatus(session, path, false);
  if (response.status !== 200) {
    let payload: unknown; try { payload = JSON.parse(body); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, fallback);
  }
  return JSON.parse(body) as unknown;
}

/** @v2 adminRawMaterialAssignmentCandidates */
export async function adminRawMaterialAssignmentCandidates(session: Session, orderId: string, apparatus = '') {
  const machine = apparatusId(apparatus, true), query = new URLSearchParams({ order_id: orderId.trim() });
  if (machine) query.set('apparatus', machine);
  const payload = await read(session, `/v1/mobile/admin/raw-material-assignments/candidates?${query}`, 'raw_material_assignment_candidates');
  if (!Array.isArray(payload)) throw new TypeError('Invalid raw material assignment candidates');
  return payload.map(rawMaterialAssignmentCandidate);
}

/** @v2 adminRawMaterialAssignmentDiagnostics */
export async function adminRawMaterialAssignmentDiagnostics(session: Session, barcode: string, orderId = '', apparatus = '') {
  const code = barcode.trim(), order = orderId.trim(), machine = apparatusId(apparatus, true);
  if (!code) throw new MobileApiException({ code: 'raw_material_invalid_input', message: 'Homashyo QR noto‘g‘ri' });
  const query = new URLSearchParams({ barcode: code });
  if (order) query.set('order_id', order);
  if (machine) query.set('apparatus', machine);
  return rawMaterialAssignmentDiagnostic(await read(session, `/v1/mobile/admin/raw-material-assignments/diagnostics?${query}`,
    'raw_material_assignment_diagnostics'));
}
