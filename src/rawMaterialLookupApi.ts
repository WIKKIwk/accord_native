import type { Session } from './auth';
import { readApparatus } from './apparatusApi';
import { productionMapResponseError } from './workerControlsApi';
import { rawMaterialAssignment } from './workerRawMaterials';
import { productionMapDefinitionFromJson } from './workerProductionMapSaved';
import { parseApparatusQueueStateMap } from './workerQueueModels';
import { productionOrderLogFromJson } from './workerClosedOrders';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const string = (value: unknown) => value == null ? '' : String(value);

export function rawMaterialLookupFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid raw material lookup');
  if (row.qty != null && typeof row.qty !== 'number') throw new TypeError('Invalid raw material quantity');
  if (row.logs != null && !Array.isArray(row.logs)) throw new TypeError('Invalid raw material logs');
  return { barcode: string(row.barcode), warehouse: string(row.warehouse), item_code: string(row.item_code),
    item_name: string(row.item_name), item_group: string(row.item_group), qty: row.qty ?? 0, uom: string(row.uom),
    status: string(row.status), reserved_order_id: string(row.reserved_order_id), source_receipt_id: string(row.source_receipt_id),
    assignment: object(row.assignment) ? rawMaterialAssignment(row.assignment) : null,
    order: object(row.order) ? productionMapDefinitionFromJson(row.order) : null,
    queue_states: parseApparatusQueueStateMap(row.queue_states), logs: (row.logs ?? []).map(productionOrderLogFromJson) };
}

/** @v2 adminRawMaterialLookup */
export async function adminRawMaterialLookup(session: Session, barcode: string) {
  const query = new URLSearchParams({ barcode: barcode.trim() });
  const { response, body } = await readApparatus(session, `/v1/mobile/admin/raw-material-assignments/lookup?${query}`, true);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = JSON.parse(body); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'raw_material_assignments');
  }
  return rawMaterialLookupFromJson(JSON.parse(body));
}
