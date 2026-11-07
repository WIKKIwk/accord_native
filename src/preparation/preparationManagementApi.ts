import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { WorkerControlException } from '../workerControlsApi';
import { jsonObject, preparationOwnedMaterialFromJson } from './preparationModel';
import { preparationGuard, preparationResponse, withQuery } from './preparationRequest';

const materialMessages: Record<string, string> = {
  preparation_material_not_owned: 'Faqat o‘zingiz yaratgan homashyoni boshqarishingiz mumkin',
  preparation_material_name_taken: 'Sizda bunday nomli homashyo mavjud. Boshqa nom kiriting',
  preparation_material_in_use: 'Homashyo ishlatilgan: qoldiq, kirim, formula yoki boshqa bog‘langan yozuvlar bor. Uni o‘chirib bo‘lmaydi',
  preparation_material_warehouse_in_use: 'Bu omborda homashyo qoldig‘i, kutilayotgan kirim yoki faol ko‘chirish bor. Avval ularni yakunlang',
  preparation_warehouse_not_exclusive: 'Faqat o‘zingizga exclusive biriktirilgan omborlarni o‘zgartirishingiz mumkin',
  preparation_conflict: 'Homashyo hozir band. Birozdan keyin qayta urinib ko‘ring',
};
const warehouseMessages: Record<string, string> = {
  preparation_warehouse_name_taken: 'Bunday nomli ombor mavjud. Boshqa nom kiriting',
  preparation_warehouse_not_empty: 'Omborda homashyo yoki mahsulot bor. Avval ularni boshqa omborga ko‘chiring',
  preparation_warehouse_has_materials: 'Omborga homashyo biriktirilgan. Avval homashyo bog‘lanishlarini olib tashlang',
  preparation_warehouse_has_children: 'Bu omborda bola omborlar bor. Avval ularni boshqaring',
  preparation_warehouse_in_use: 'Omborda bog‘langan yozuvlar yoki faol operatsiyalar bor. Uni o‘chirib bo‘lmaydi',
  preparation_warehouse_not_exclusive: 'Bola omborni faqat o‘zingizga eksklyuziv biriktirilgan omborda ochishingiz mumkin',
  preparation_warehouse_not_owned: 'Faqat o‘zingiz yaratgan va faqat sizga biriktirilgan bola omborni boshqarishingiz mumkin',
  preparation_scope: 'Faqat o‘zingiz yaratgan va faqat sizga biriktirilgan bola omborni boshqarishingiz mumkin',
  preparation_invalid: 'Ombor nomi 1–160 ta belgidan iborat va ota ombor nomidan farqli bo‘lishi kerak',
  preparation_conflict: 'Ombor hozir band yoki unga boshqa yozuvlar bog‘langan. Ma’lumotlarni yangilab, qayta urinib ko‘ring',
};
async function managementRequest(session: Session, method: string, payload: Record<string, unknown>, kind: 'material' | 'warehouse', suffix = '') {
  const guard = preparationGuard(session, true);
  const base = `/v1/mobile/preparation/${kind === 'material' ? 'materials' : 'warehouses'}${suffix}`;
  const path = method === 'DELETE' ? withQuery(base, payload as Record<string, string>) : base;
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (method !== 'GET' && method !== 'DELETE') init.body = JSON.stringify(payload);
  const response = await authorizedFetch(session, path, init, guard);
  guard();
  let data: Record<string, unknown> | null = null;
  try { data = jsonObject(await response.json()); } catch { /* Invalid JSON follows V2's error path. */ }
  if (kind === 'material' && response.status === 200 && data) return data;
  if (kind === 'warehouse' && response.status === 200 && typeof data?.warehouse === 'string' && data.warehouse.trim()) return data;
  const code = typeof data?.code === 'string' ? data.code : `preparation_${kind}_failed`;
  let message: string | undefined = (kind === 'material' ? materialMessages : warehouseMessages)[code];
  if (kind === 'material' && code === 'preparation_invalid') message = suffix === '/warehouses'
    ? 'Omborlar ro‘yxati noto‘g‘ri. Ro‘yxatni yangilab, qayta tanlang'
    : 'Homashyo nomi 1–160 ta belgidan iborat bo‘lishi kerak';
  if (!message) {
    if (response.status === 401) message = 'Sessiya tugagan. Qayta kiring';
    else if (response.status === 403) message = kind === 'material' ? 'Bu amal uchun Tayyorlov masteri huquqi kerak' : 'Bu omborni boshqarish huquqingiz yo‘q';
    else message = kind === 'material' ? 'Homashyo bilan amal bajarilmadi. Birozdan keyin qayta urinib ko‘ring'
      : 'Ombor bilan amal bajarilmadi. Birozdan keyin qayta urinib ko‘ring';
  }
  throw new WorkerControlException(code, message, response.status);
}
function invalid(message: string): never { throw new WorkerControlException('invalid_response', message); }
/** @v2 preparationOwnedMaterials */
export async function preparationOwnedMaterials(session: Session) {
  const data = await managementRequest(session, 'GET', {}, 'material');
  if (!Array.isArray(data.materials)) throw new TypeError('Invalid materials');
  return data.materials.map(preparationOwnedMaterialFromJson);
}
/** Fresh assignment options without loading the full preparation snapshot. */
export async function preparationMaterialWarehouseOptions(session: Session, itemCode: string) {
  const code = itemCode.trim();
  if (!code) invalid('Homashyo kodi noto‘g‘ri');
  const guard = preparationGuard(session, true);
  const response = await authorizedFetch(session, withQuery('/v1/mobile/preparation/materials/warehouses', { item_code: code }),
    { headers: { 'Cache-Control': 'no-cache' } }, guard);
  guard();
  // Older servers only support PATCH at this path.
  if (response.status === 404 || response.status === 405) return null;
  const data = await preparationResponse(response);
  guard();
  if (data.item_code !== code || !Array.isArray(data.warehouses) || !Array.isArray(data.editable_warehouses) ||
      data.warehouses.some(value => typeof value !== 'string' || !value.trim()) ||
      data.editable_warehouses.some(value => typeof value !== 'string' || !value.trim())) {
    invalid('Omborlar ro‘yxati mos kelmadi. Qayta urinib ko‘ring');
  }
  return { assigned: data.warehouses as string[], editable: data.editable_warehouses as string[] };
}
/** @v2 preparationRenameMaterial */
export async function preparationRenameMaterial(session: Session, itemCode: string, name: string) {
  const data = await managementRequest(session, 'PATCH', { item_code: itemCode, name: name.trim() }, 'material');
  if (data.item_code !== itemCode || typeof data.name !== 'string' || !data.name.trim()) invalid('Server javobi tushunarsiz. Ro‘yxatni yangilang');
  return data.name as string;
}
/** @v2 preparationDeleteMaterial */
export async function preparationDeleteMaterial(session: Session, itemCode: string) {
  const data = await managementRequest(session, 'DELETE', { item_code: itemCode }, 'material');
  if (data.item_code !== itemCode || data.deleted !== true) invalid('O‘chirish tasdiqlanmadi. Ro‘yxatni yangilang');
}
/** @v2 preparationSetMaterialWarehouses */
export async function preparationSetMaterialWarehouses(session: Session, itemCode: string, warehouses: string[]) {
  const data = await managementRequest(session, 'PATCH', { item_code: itemCode, warehouses }, 'material', '/warehouses');
  if (data.item_code !== itemCode || typeof data.name !== 'string' || !Array.isArray(data.warehouses) || data.warehouses.some(v => typeof v !== 'string')) {
    invalid('Ombor biriktirilgani tasdiqlanmadi. Ro‘yxatni yangilang');
  }
  return preparationOwnedMaterialFromJson(data);
}
/** @v2 preparationCreateWarehouse */
export async function preparationCreateWarehouse(session: Session, name: string, parent: string) {
  const data = await managementRequest(session, 'POST', { name: name.trim(), parent_warehouse: parent.trim() }, 'warehouse');
  return (data.warehouse as string).trim();
}
/** @v2 preparationRenameWarehouse */
export async function preparationRenameWarehouse(session: Session, warehouse: string, name: string) {
  const data = await managementRequest(session, 'PATCH', { warehouse: warehouse.trim(), name: name.trim() }, 'warehouse');
  return (data.warehouse as string).trim();
}
/** @v2 preparationDeleteWarehouse */
export async function preparationDeleteWarehouse(session: Session, warehouse: string) {
  await managementRequest(session, 'DELETE', { warehouse: warehouse.trim() }, 'warehouse');
}
