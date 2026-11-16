import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
import { adminAssignCustomerItem, adminRemoveCustomerItem } from './adminCustomerDetailApi';
import { moveAdminCatalogItems } from './adminItemCatalogApi';
import { adminItemDetailFromJson, type AdminItemDetailCustomer } from './adminItemDetailModel';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminUserCreateCustomerFromJson } from './adminUserCreateModel';
import { dartPartialLower, dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';
import { adminItemGroups, adminItemMutationError } from './itemGroupApi';

type Guard = () => void;
type Witness = () => boolean;
export class AdminItemDetailApiException extends Error { toString(): string { return `Exception: ${this.message}`; } }
const requiredGuard = (guard: Guard): Guard => {
  const check = checkedAdminGuard(guard); if (!check) throw new TypeError('Item detail requires its original guard'); return check;
};
function requiredRead(guard: Guard, witness: Witness): Guard {
  const check = requiredGuard(guard); if (typeof witness !== 'function') throw new TypeError('Item detail read requires its original witness'); return check;
}
async function response(session: Session, path: string, init: RequestInit | undefined, guard: Guard, witness?: Witness): Promise<Response> {
  const check = witness === undefined ? requiredGuard(guard) : requiredRead(guard, witness); check();
  try {
    const result = witness === undefined ? await authorizedFetch(session, path, init, check)
      : await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness });
    check(); return result;
  } catch (error) { check(); throw error; }
}
async function payload(result: Response, guard: Guard): Promise<unknown> {
  const check = requiredGuard(guard);
  try { const value: unknown = await result.json(); check(); return value; } catch (error) { check(); throw error; }
}
/** @v2 _adminItemDetailException; unlike mutation errors, a present empty error string replaces the fallback code. */
async function detailError(result: Response, guard: Guard): Promise<MobileApiException> {
  const check = requiredGuard(guard); let code = 'item_update_failed';
  try {
    const value = await payload(result, check);
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).error === 'string') code = dartTrim((value as Record<string, string>).error);
  } catch { check(); }
  check();
  const messages: Record<string, string> = { 'item not found': 'Item topilmadi', 'item code already exists': 'Bu item code allaqachon mavjud',
    'item code is required': 'Item code kiriting', 'item name is required': 'Item nomini kiriting' };
  return new MobileApiException({ code, statusCode: result.status, message: Object.hasOwn(messages, code) ? messages[code]
    : result.status === 403 ? 'Itemni tahrirlash uchun admin huquqi kerak' : 'Item ma’lumotlari saqlanmadi' });
}
async function detailResponse(result: Response, guard: Guard) {
  const check = requiredGuard(guard); check();
  try {
    if (result.status !== 200) { const error = await detailError(result, check); check(); throw error; }
    const value = await payload(result, check); try { return adminItemDetailFromJson(value); } finally { check(); }
  } catch (error) { check(); throw error; }
}
/** @v2 adminItemDetail; the screen opts into includeImage, follow-up and component-name reads use false. */
export async function adminItemDetail(session: Session, itemCode: string, options: Readonly<{ includeImage?: boolean }>, guard: Guard, witness: Witness) {
  const check = requiredRead(guard, witness); check();
  const path = `/v1/mobile/admin/items/detail?code=${dartQueryComponent(dartTrim(itemCode))}${options.includeImage === true ? '&include_image=true' : ''}`;
  return detailResponse(await response(session, path, undefined, check, witness), check);
}
/** @v2 adminUpdateItem */
export async function adminUpdateItemDetail(session: Session, input: Readonly<{ originalCode: string; code: string; name: string }>, guard: Guard) {
  const check = requiredGuard(guard); check();
  const init = { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original_code: dartTrim(input.originalCode), code: dartTrim(input.code), name: dartTrim(input.name) }) };
  check();
  return detailResponse(await response(session, '/v1/mobile/admin/items/detail', init, check), check);
}
/** @v2 adminDeleteItem; a successful response does not need a JSON body. */
export async function adminDeleteItemDetail(session: Session, itemCode: string, guard: Guard): Promise<void> {
  const check = requiredGuard(guard); check(); const code = dartTrim(itemCode);
  if (!code) throw new MobileApiException({ code: 'item code is required', message: 'Item code kiriting' });
  const result = await response(session, `/v1/mobile/admin/items/detail?code=${dartQueryComponent(code)}`, { method: 'DELETE' }, check);
  if (result.status !== 200) {
    try { const error = await adminItemMutationError(result, 'item_delete_failed', 'Item o‘chirilmadi'); check(); throw error; }
    catch (error) { check(); throw error; }
  }
  check();
}
/** @v2 adminUpdateItemGroup; the real bulk acknowledgment is checked before the follow-up detail read. */
export async function adminUpdateItemDetailGroup(session: Session, itemCode: string, itemGroup: string, guard: Guard, witness: Witness) {
  const check = requiredRead(guard, witness); check(); const code = dartTrim(itemCode), group = dartTrim(itemGroup);
  check();
  if (!code || !group) throw new MobileApiException({ code: 'item_group_update_invalid', message: 'Item va groupni tanlang' });
  const result = await moveAdminCatalogItems(session, [code], group, check); check();
  const updated = result.failed_count === 0 && result.updated_item_codes.some(value => dartPartialLower(dartTrim(value)) === dartPartialLower(code)); check();
  if (!updated)
    throw new MobileApiException({ code: 'item_group_update_failed', message: 'Item group o‘zgartirilmadi' });
  return adminItemDetail(session, code, {}, check, witness);
}
/** @v2 adminSetItemCustomerAssigned; source parses the customer acknowledgment then re-reads the item. */
export async function adminSetItemDetailCustomerAssigned(session: Session, itemCode: string, customer: AdminItemDetailCustomer, assigned: boolean, guard: Guard, witness: Witness) {
  const check = requiredRead(guard, witness); check(); const code = dartTrim(itemCode), ref = dartTrim(customer.ref);
  check();
  if (!code || !ref) throw new MobileApiException({ code: 'item_customer_update_invalid', message: 'Item va customerni tanlang' });
  try {
    if (assigned) await adminAssignCustomerItem(session, ref, code, check); else await adminRemoveCustomerItem(session, ref, code, check);
    check(); return await adminItemDetail(session, code, {}, check, witness);
  } catch (error) { check(); throw error; }
}
/** Source picker uses the complete group catalog, retaining its source plain Exception text. */
export async function adminItemDetailGroups(session: Session, guard: Guard, witness: Witness): Promise<readonly string[]> {
  const check = requiredRead(guard, witness); check();
  try { const groups = await adminItemGroups(session, check, witness); check(); return Object.freeze([...groups]); }
  catch (error) { check(); if (error instanceof Error && error.message === 'Admin item groups failed') throw new AdminItemDetailApiException(error.message); throw error; }
}
/** @v2 adminCustomers; this picker submits the search explicitly and reads one 200-row page. */
export async function adminItemDetailCustomers(session: Session, query: string, guard: Guard, witness: Witness): Promise<readonly AdminItemDetailCustomer[]> {
  const check = requiredRead(guard, witness); check(); const search = dartTrim(query);
  const result = await response(session, `/v1/mobile/admin/customers/list?${search ? `q=${dartQueryComponent(search)}&` : ''}limit=200`, undefined, check, witness);
  try {
    if (result.status !== 200) throw new AdminItemDetailApiException('Admin customers failed');
    const value = await payload(result, check);
    try { if (!Array.isArray(value)) throw new TypeError('Invalid customer directory'); return Object.freeze(value.map(adminUserCreateCustomerFromJson)); }
    finally { check(); }
  } catch (error) { check(); throw error; }
}
