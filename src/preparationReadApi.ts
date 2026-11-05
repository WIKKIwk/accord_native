import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
function preparationKey(session: Session): string {
  if (session.profile?.role !== 'tayyorlov_masteri' || typeof session.profile?.ref !== 'string' || !session.profile.ref ||
      !session.capabilities?.includes('preparation.access')) throw new WorkerControlException('forbidden', 'Tayyorlov masteri huquqi kerak');
  return `preparation.pending.v1:${session.baseUrl}:${session.profile.ref}`;
}
async function readPreparation(session: Session, path: string) {
  const key = preparationKey(session), guard = () => { if (preparationKey(session) !== key) throw new Error('Akkaunt o‘zgargan'); };
  const response = await authorizedFetch(session, path, {}, guard); guard();
  let raw: unknown; try { raw = await response.json(); } catch { raw = null; }
  const data = object(raw);
  if (response.status !== 200 || !data) throw new WorkerControlException('preparation_request_failed',
    typeof data?.error === 'string' ? data.error : 'Tayyorlov ma’lumotlari olinmadi. Qayta urinib ko‘ring', response.status);
  return data;
}
/** @v2 PreparationResponsibility */
export function preparationResponsibilityFromJson(value: unknown) {
  const row = object(value);
  if (!row || (row.material_id != null && typeof row.material_id !== 'string') ||
      (row.material_name != null && typeof row.material_name !== 'string') || (row.estimated_kg != null && typeof row.estimated_kg !== 'string'))
    throw new TypeError('Invalid preparation responsibility');
  return { material_id: (row.material_id ?? '').trim(), material_name: (row.material_name ?? '').trim(), estimated_kg: row.estimated_kg ?? null };
}
/** @v2 preparationOrderMaterials */
export async function preparationOrderMaterials(session: Session, orderId: string) {
  const id = orderId.trim(); if (!id) throw new WorkerControlException('preparation_invalid', 'Order topilmadi');
  const query = new URLSearchParams({ order_id: id });
  const data = await readPreparation(session, `/v1/mobile/preparation/order-materials?${query}`);
  return Array.isArray(data.materials) ? data.materials.filter(object).map(preparationResponsibilityFromJson) : [];
}
/** @v2 PreparationSnapshot */
export function preparationSnapshotFromJson(value: unknown) {
  const row = object(value); if (!row) throw new TypeError('Invalid preparation snapshot');
  const list = (value: unknown): unknown[] => { if (!Array.isArray(value)) throw new TypeError('Invalid preparation list'); return value; };
  const warehouseList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const requiredString = (value: unknown) => { if (typeof value !== 'string') throw new TypeError('Invalid preparation string'); return value; };
  const materials = list(row.materials).map(value => {
    const item = object(value); if (!item) throw new TypeError('Invalid preparation material');
    const balances: Record<string, string> = {};
    for (const raw of item.balances == null ? [] : list(item.balances)) {
      const balance = object(raw); if (!balance) throw new TypeError('Invalid preparation balance');
      balances[requiredString(balance.warehouse)] = requiredString(balance.kg);
    }
    const visible = Object.hasOwn(item, 'visible_warehouses') ? [...new Set(warehouseList(item.visible_warehouses).map(v => v.trim().toLowerCase()).filter(Boolean))] : null;
    return { code: requiredString(item.item_code), name: requiredString(item.name), can_receive: item.can_receive !== false,
      visible_warehouses: visible, balances };
  });
  const orders = list(row.orders).map(value => {
    const item = object(value); if (!item) throw new TypeError('Invalid preparation order');
    const widthText = item.width_mm == null ? '' : String(item.width_mm).trim(), parsed = widthText ? Number(widthText) : NaN;
    return { id: requiredString(item.id), code: item.code == null ? '' : requiredString(item.code), title: item.title == null ? '' : requiredString(item.title),
      kg: requiredString(item.order_kg), width_mm: Number.isNaN(parsed) ? null : parsed, saved: item.saved === true };
  });
  const history = list(row.history).map(value => { const item = object(value); if (!item) throw new TypeError('Invalid preparation history'); return item; });
  return { warehouses: warehouseList(row.warehouses), assigned_warehouses: warehouseList(row.assigned_warehouses),
    material_warehouses: warehouseList(row.material_warehouses), managed_warehouses: warehouseList(row.managed_warehouses),
    materials, orders, history, responsibilities: (row.responsibilities == null ? [] : list(row.responsibilities)).map(preparationResponsibilityFromJson) };
}
/** @v2 preparationSnapshot */
export async function preparationSnapshot(session: Session) {
  return preparationSnapshotFromJson(await readPreparation(session, '/v1/mobile/preparation/snapshot'));
}
