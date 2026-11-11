import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, postWorkerApiRequest, productionMapResponseError, WorkerControlException } from './workerControlsApi';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as ObjectValue : null;
const text = (value: unknown) => value == null ? '' : String(value);
const number = (value: unknown, optional = false): number | null => {
  if (value == null) return optional ? null : 0;
  if (typeof value !== 'number') throw new TypeError('Invalid material quantity');
  return value;
};
function apparatusId(value: string, allowEmpty = false): string {
  const normalized = value.trim();
  if ((!allowEmpty || normalized) && !isCanonicalApparatusId(normalized)) {
    throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  }
  return normalized;
}

/** @v2 AdminRawMaterialAssignment */
export type AdminRawMaterialAssignment = {
  execution_status: string; roll_width_mm: number | null; order_id: string; apparatus: string;
  barcode: string; item_code: string; item_name: string; item_group: string; assigned_by_ref: string;
  assigned_by_name: string; assigned_at: string; stock_status: string; reserved_order_id: string;
  stock_warehouse: string; stock_qty: number; stock_uom: string; received_qty: number;
  consumed_qty: number; remaining_qty: number;
};

export function rawMaterialAssignment(value: unknown): AdminRawMaterialAssignment {
  const row = object(value);
  if (!row) throw new TypeError('Invalid material assignment');
  return {
    execution_status: text(row.execution_status), roll_width_mm: number(row.roll_width_mm, true),
    order_id: text(row.order_id), apparatus: apparatusId(text(row.apparatus_id ?? row.apparatus)),
    barcode: text(row.barcode), item_code: text(row.item_code), item_name: text(row.item_name),
    item_group: text(row.item_group), assigned_by_ref: text(row.assigned_by_ref),
    assigned_by_name: text(row.assigned_by_display_name ?? row.assigned_by_name), assigned_at: text(row.assigned_at),
    stock_status: text(row.stock_status), reserved_order_id: text(row.reserved_order_id),
    stock_warehouse: text(row.stock_warehouse), stock_qty: number(row.stock_qty)!, stock_uom: text(row.stock_uom),
    received_qty: number(row.received_qty)!, consumed_qty: number(row.consumed_qty)!, remaining_qty: number(row.remaining_qty)!,
  };
}

async function assignments(session: Session, path: string, query: URLSearchParams, fallback: string) {
  await Promise.resolve();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, `${path}?${query}`, { signal: controller.signal });
    if (response.status !== 200) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, fallback, response.headers);
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new TypeError('Invalid material assignments');
    return data.map(rawMaterialAssignment);
  } finally { clearTimeout(timer); }
}

/** @v2 adminRawMaterialAssignments */
export async function adminRawMaterialAssignments(session: Session, orderId = '', apparatus = '') {
  const station = apparatusId(apparatus, true), query = new URLSearchParams();
  if (orderId.trim()) query.set('order_id', orderId.trim());
  if (station) query.set('apparatus', station);
  return assignments(session, '/v1/mobile/admin/raw-material-assignments', query, 'raw_material_assignments');
}

/** @v2 adminRawMaterialIntakeCandidates */
export async function adminRawMaterialIntakeCandidates(session: Session, orderId: string, apparatus: string) {
  const query = new URLSearchParams({ order_id: orderId.trim(), apparatus: apparatusId(apparatus) });
  return assignments(session, '/v1/mobile/admin/raw-material-intake-candidates', query, 'raw_material_intake_candidates');
}

/** @v2 AdminRawMaterialStartRequirements */
export type AdminRawMaterialStartRequirements = {
  policy: 'state_all' | 'requirement_groups'; requires_material: boolean; requirement_groups: ObjectValue[];
  assigned_barcodes: string[]; staged_barcodes: string[]; assignments: AdminRawMaterialAssignment[];
  start_assignments: AdminRawMaterialAssignment[]; required_scan_count: number; matched_scan_count: number;
  assignments_satisfied: boolean; scan_satisfied: boolean;
};
const intValue = (value: unknown, fallback: number) => /^[-+]?\d+$/.test(String(value ?? '')) ? Number(value) : fallback;
const barcodeList = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map(item => String(item).trim().toUpperCase()).filter(Boolean))] : [];

export function rawMaterialStartRequirements(value: unknown): AdminRawMaterialStartRequirements {
  const row = object(value);
  if (!row) throw new TypeError('Invalid material requirements');
  const list = (key: string) => Array.isArray(row[key]) ? (row[key] as unknown[]).filter(object).map(rawMaterialAssignment) : [];
  return {
    policy: text(row.policy).trim().toLowerCase() === 'requirement_groups' ? 'requirement_groups' : 'state_all',
    requires_material: row.requires_material === true,
    requirement_groups: Array.isArray(row.requirement_groups) ? row.requirement_groups.flatMap((raw: unknown) => {
      const group = object(raw);
      if (!group) return [];
      const groups = group.item_group_ids ?? group.item_groups;
      return [{ name: text(group.requirement_id ?? group.name).trim(),
        item_groups: Array.isArray(groups) ? groups.map(item => String(item).trim()).filter(Boolean) : [],
        min_required_count: intValue(group.minimum_required_count ?? group.min_required_count, 1) }];
    }) : [],
    assigned_barcodes: barcodeList(row.assigned_barcodes), staged_barcodes: barcodeList(row.staged_barcodes),
    assignments: list('assignments'), start_assignments: list('start_assignments'),
    required_scan_count: intValue(row.required_scan_count, 0), matched_scan_count: intValue(row.matched_scan_count, 0),
    assignments_satisfied: row.assignments_satisfied === true, scan_satisfied: row.scan_satisfied === true,
  };
}

/** @v2 adminRawMaterialStartRequirements */
export async function adminRawMaterialStartRequirements(session: Session, orderId: string, apparatus: string,
  materialBarcodes: string[] = []): Promise<AdminRawMaterialStartRequirements> {
  const query = new URLSearchParams({ order_id: orderId.trim(), apparatus: apparatusId(apparatus) });
  if (materialBarcodes.length) query.set('material_barcodes', materialBarcodes.join(','));
  await Promise.resolve();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/raw-material-start-requirements?${query}`, { signal: controller.signal });
    if (response.status !== 200) {
      let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'raw_material_start_requirements', response.headers);
    }
    return rawMaterialStartRequirements(await response.json());
  } finally { clearTimeout(timer); }
}

/** @v2 adminReceiveRawMaterialForActiveOrder */
export async function adminReceiveRawMaterialForActiveOrder(session: Session, orderId: string, apparatus: string,
  barcode: string): Promise<AdminRawMaterialAssignment> {
  const body = { order_id: orderId.trim(), apparatus: apparatusId(apparatus), barcode: barcode.trim() };
  return rawMaterialAssignment(await postWorkerApiRequest(session, '/v1/mobile/admin/raw-material-intake', body,
    null, false, 'raw_material_intake'));
}
