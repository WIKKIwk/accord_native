import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { productionMapSavedFromJson } from '../workerProductionMapSaved';
import { productionMapResponseError } from '../workerControlsApi';
import { checkedAdminGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';
import { adminWarehouseStockRollFromJson, type AdminWarehouseStockItem, type AdminWarehouseStockRoll } from './warehouseStockApi';

export type AdminWarehouseItemRollsGuard = () => void;
export function adminWarehouseItemRollsChecked(guard: AdminWarehouseItemRollsGuard, witness?: () => boolean) {
  const checked = checkedAdminGuard(guard); if (!checked || witness !== undefined && typeof witness !== 'function') throw new TypeError('Warehouse child requires its original guard');
  let expired = false, checking = false;
  return () => {
    if (expired || checking) { expired = true; throw new Error('Warehouse child expired'); }
    checking = true;
    try { checked(); if (witness && !isSynchronouslyTrue(witness)) throw new Error('Warehouse child expired'); checked(); }
    catch (error) { expired = true; throw error; } finally { checking = false; }
  };
}
/** Additive guarded read: the legacy warehouseStockApi defaults and callers remain unchanged. */
export async function readAdminWarehouseItemRolls(session: Session, item: AdminWarehouseStockItem, guard: AdminWarehouseItemRollsGuard, witness: () => boolean): Promise<AdminWarehouseStockRoll[]> {
  if (typeof witness !== 'function') throw new TypeError('Scoped warehouse child read requires a witness');
  const check = adminWarehouseItemRollsChecked(guard, witness);
  try {
    check(); const warehouse = dartTrim(item.warehouse), code = dartTrim(item.code); if (!warehouse || !code) return [];
    const query = Object.entries({ warehouse, item_code: code, ...(dartTrim(item.order_id) ? { order_id: dartTrim(item.order_id) } : {}), limit: '500' })
      .map(([key, value]) => `${dartQueryComponent(key)}=${dartQueryComponent(value)}`).join('&');
    const response = await authorizedFetch(session, `/v1/mobile/admin/warehouses/items/rolls?${query}`, {}, check, 10_000, { readWitness: witness }); check();
    if (response.status !== 200) throw new Error('Admin warehouse rolls failed');
    const value: unknown = await response.json(); check(); if (!Array.isArray(value)) throw new TypeError('Invalid warehouse stock list');
    const result = value.map(adminWarehouseStockRollFromJson); check(); return result;
  } catch (error) { check(); throw error; }
}
/** The source reserved-order detail block uses the full production-map DTO, including parser failures. */
export async function readAdminWarehouseItemRollsOrder(session: Session, orderId: string, guard: AdminWarehouseItemRollsGuard, witness: () => boolean) {
  if (typeof witness !== 'function') throw new TypeError('Scoped warehouse child read requires a witness');
  const check = adminWarehouseItemRollsChecked(guard, witness);
  try {
    check(); const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps?id=${dartQueryComponent(dartTrim(orderId))}`, {}, check, 10_000, { readWitness: witness }); check();
    let value: unknown;
    try { value = await response.json(); check(); } catch (error) { check(); if (response.status === 200) throw error; value = null; }
    if (response.status !== 200) { const error = productionMapResponseError(response.status, value, 'production_map_load_failed'); check(); throw error; }
    const result = productionMapSavedFromJson(value); check(); return result;
  } catch (error) { check(); throw error; }
}
