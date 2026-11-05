import { isCanonicalApparatusId } from './workerControlsApi';
type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const str = (v: unknown) => v == null ? '' : String(v);
const kind = (v: unknown) => ['state', 'transit'].includes(str(v).trim().toLowerCase()) ? str(v).trim().toLowerCase() : 'warehouse';
const num = (v: unknown, fallback: number) => { if (v == null) return fallback; if (typeof v !== 'number') throw new TypeError('Invalid inventory number'); return v; };
export function inventoryLocationReferenceFromJson(value: unknown) {
  const row = object(value) ?? {};
  return { id: str(row.id), kind: kind(row.kind), name: str(row.name) };
}
/** @v2 InventoryLocation */
export function inventoryLocationFromJson(value: unknown) {
  const row = object(value); if (!row) throw new TypeError('Invalid inventory location');
  if (row.active != null && typeof row.active !== 'boolean') throw new TypeError('Invalid inventory location active flag');
  const apparatus = (Array.isArray(row.apparatus) ? row.apparatus : []).filter(object).map((item: Obj) => {
    const id = str(item.id).trim();
    if (!isCanonicalApparatusId(id)) throw new TypeError('Inventory location requires canonical apparatus ID');
    return { id, name: str(item.name) };
  });
  return { id: str(row.id), kind: kind(row.kind), name: str(row.name), warehouse_id: str(row.warehouse_id),
    factory_location_id: str(row.factory_location_id), active: row.active ?? true, apparatus };
}
/** @v2 InventoryAsset */
export function inventoryAssetFromJson(value: unknown) {
  const row = object(value); if (!row) throw new TypeError('Invalid inventory asset');
  const assetKind = str(row.kind).trim().toLowerCase();
  const assignment = row.order_assignment == null ? null : object(row.order_assignment);
  if (row.order_assignment != null && !assignment) throw new TypeError('Invalid inventory order assignment');
  if (assignment && (typeof assignment.order_id !== 'string' || !assignment.order_id.trim() || typeof assignment.order_label !== 'string' ||
      !assignment.order_label.trim() || !['active', 'freeze_requested', 'frozen'].includes(assignment.order_control ?? 'active')))
    throw new TypeError('Invalid inventory order assignment');
  return { kind: ['finished_goods', 'qolip'].includes(assetKind) ? assetKind : 'raw_material', asset_ref: str(row.asset_ref),
    custody_warehouse_id: str(row.custody_warehouse_id), custody_warehouse: str(row.custody_warehouse), item_code: str(row.item_code),
    item_name: str(row.item_name), identifier: str(row.identifier), qty: num(row.qty, 0), uom: str(row.uom), status: str(row.status),
    physical_location: inventoryLocationReferenceFromJson(row.physical_location), transfer_id: str(row.transfer_id),
    placement_version: Math.trunc(num(row.placement_version, 1)), order_assignment_known: Object.hasOwn(row, 'order_assignment'),
    order_assignment: assignment ? { order_id: assignment.order_id, order_label: assignment.order_label, order_control: assignment.order_control ?? 'active' } : null };
}
