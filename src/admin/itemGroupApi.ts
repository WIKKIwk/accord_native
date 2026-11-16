import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminItemsPage } from '../gscale/gscaleAdminApi';
import type { SupplierItem } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { dartJsonString, dartTrim } from './dartJsonString';
import { adminItemGroupBulkMoveResultFromJson, adminItemGroupFromJson,
  type AdminItemGroup, type AdminItemGroupBulkMoveResult, type AdminItemGroupTreeEntry } from './itemGroupModel';

async function responseList(response: Response): Promise<unknown[]> {
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new TypeError('Invalid list');
  return data;
}
async function mutationError(response: Response, fallbackCode: string, fallbackMessage: string): Promise<MobileApiException> {
  let code = fallbackCode;
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const error = (payload as Record<string, unknown>).error;
      if (typeof error === 'string' && dartTrim(error)) code = dartTrim(error);
    }
  } catch { /* V2 falls back for a non-JSON response. */ }
  const messages: Record<string, string> = {
    'item code already exists': 'Bu item code allaqachon mavjud',
    'item code is required': 'Item code kiriting',
    'tayyor mahsulot uchun kamida bitta customer kerak': 'Tayyor mahsulot uchun kamida bitta customer kerak',
    'customer_ref is required for tayyor mahsulot': 'Tayyor mahsulot uchun customer tanlang',
    'customer not found': 'Customer topilmadi',
    'item not found': 'Item topilmadi',
    'item is used by active order': 'Item faol buyurtmada ishlatilgan. Avval buyurtmani yakunlang yoki bekor qiling',
    'item has active stock': 'Item bo‘yicha faol ombor qoldig‘i bor. Avval qoldiqni yakunlang',
    'item has pending receipt': 'Item uchun yakunlanmagan qabul mavjud',
    'item is used by active rps batch': 'Item faol RPS partiyasida ishlatilgan',
    'item is used by active qolip operation': 'Item faol qolip jarayonida ishlatilgan',
    'item is used by quick order template': 'Item tezkor buyurtma shablonida ishlatilgan',
    'item is used by unresolved material assignment': 'Item yakunlanmagan material biriktirishda ishlatilgan',
    'item is still referenced': 'Item boshqa ma’lumotlarga bog‘langanligi sababli o‘chirilmadi',
  };
  return new MobileApiException({ code, statusCode: response.status,
    message: Object.hasOwn(messages, code) ? messages[code] : (response.status === 403 ? 'Bu amal uchun admin huquqi kerak' : fallbackMessage) });
}

/** @v2 adminItemGroups */
export async function adminItemGroups(session: Session, beforeSend?: () => void, readWitness?: () => boolean): Promise<string[]> {
  try {
    const response = await itemGroupsRead(session, '/v1/mobile/admin/item-groups', beforeSend, readWitness);
    if (response.status !== 200) throw new Error('Admin item groups failed');
    const result = (await responseList(response)).map(dartJsonString);
    beforeSend?.(); return result;
  } catch (error) { beforeSend?.(); throw error; }
}
/** @v2 adminItemGroupTree */
export async function adminItemGroupTree(session: Session, beforeSend?: () => void, readWitness?: () => boolean): Promise<AdminItemGroupTreeEntry[]> {
  try {
    const response = await itemGroupsRead(session, '/v1/mobile/admin/item-groups/tree', beforeSend, readWitness);
    if (response.status !== 200) throw new Error('Admin item group tree failed');
    const result = (await responseList(response)).map(adminItemGroupFromJson);
    beforeSend?.(); return result;
  } catch (error) { beforeSend?.(); throw error; }
}
/** @v2 adminCreateItemGroup */
export async function adminCreateItemGroup(session: Session, name: string, parent: string, isGroup: boolean, beforeSend?: () => void): Promise<AdminItemGroup> {
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/item-groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent, is_group: isGroup }),
    }, beforeSend);
    beforeSend?.();
    if (response.status !== 200) throw new Error('Admin item group create failed');
    const data: unknown = await response.json(); beforeSend?.();
    const result = adminItemGroupFromJson(data); beforeSend?.(); return result;
  } catch (error) { beforeSend?.(); throw error; }
}
/** @v2 adminMoveItemGroupParent */
export async function adminMoveItemGroupParent(session: Session, name: string, parent: string, beforeSend?: () => void): Promise<AdminItemGroup> {
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/item-groups', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parent }),
    }, beforeSend);
    beforeSend?.();
    if (response.status !== 200) throw await mutationError(response, 'item_group_parent_move_failed', 'Item group parenti o‘zgartirilmadi');
    const data: unknown = await response.json(); beforeSend?.();
    const result = adminItemGroupFromJson(data); beforeSend?.(); return result;
  } catch (error) { beforeSend?.(); throw error; }
}
/** @v2 adminMoveItemsToGroup */
export async function adminMoveItemsToGroup(session: Session, itemCodes: string[], itemGroup: string): Promise<AdminItemGroupBulkMoveResult> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/items/bulk-move-group', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_codes: itemCodes, item_group: itemGroup }),
  });
  if (response.status !== 200) throw await mutationError(response, 'item_group_bulk_move_failed', 'Mahsulotlar groupga ko‘chirilmadi');
  return adminItemGroupBulkMoveResultFromJson(await response.json());
}
/** @v2 adminItemUoms */
export async function adminItemUoms(session: Session): Promise<string[]> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/items/uoms');
  if (response.status !== 200) throw new Error('Admin item UOMs failed');
  return (await responseList(response)).filter((value): value is string => typeof value === 'string')
    .map(dartTrim).filter(Boolean);
}
/** @v2 adminItems */
export async function adminItems(session: Session, query = '', group = ''): Promise<SupplierItem[]> {
  const items: SupplierItem[] = [], pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const page = await adminItemsPage(session, { query, group, limit: pageSize, offset });
    items.push(...page);
    if (page.length < pageSize) return items;
  }
}

/** Opt-in original-witness transport for the Item Groups screen. */
async function itemGroupsRead(session: Session, path: string, guard?: () => void, readWitness?: () => boolean): Promise<Response> {
  if (readWitness === undefined) return guard ? authorizedFetch(session, path, {}, guard) : authorizedFetch(session, path);
  if (typeof guard !== 'function' || typeof readWitness !== 'function') throw new TypeError('Item groups read requires a guard and witness');
  guard(); const response = await authorizedFetch(session, path, {}, guard, 10_000, { readWitness }); guard(); return response;
}
