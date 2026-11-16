import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { supplierItemFromJson, type SupplierItem } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { adminApiError } from './adminApiError';
import { adminCustomerDetailFromJson, adminCustomerDetailObject, adminCustomerScopeValues, type AdminCustomerDetail } from './adminCustomerDetailModel';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminRoleAssignments } from './adminUsersApi';
import { adminRoleAssignmentFromJson, type AdminRoleAssignment } from './adminUsersModel';
import { adminWarehouseSettingsAssignments } from './adminWarehouseSettingsApi';
import { dartPartialLower, dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';
import { adminItemMutationError } from './itemGroupApi';

export class AdminCustomerDetailApiException extends Error { toString(): string { return `Exception: ${this.message}`; } }
type Guard = () => void;
type Witness = () => boolean;
const pathRef = (path: string, ref: string) => `${path}?ref=${dartQueryComponent(ref)}`;
const write = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function response(session: Session, path: string, init: RequestInit | undefined, guard?: Guard, witness?: Witness): Promise<Response> {
  const check = checkedAdminGuard(guard); if (witness !== undefined && (!check || typeof witness !== 'function')) throw new TypeError('Scoped customer read requires guard and witness');
  check?.();
  try {
    const result = witness !== undefined && (!init?.method || init.method === 'GET') ? await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness }) : await authorizedFetch(session, path, init, check);
    check?.(); return result;
  } catch (error) { check?.(); throw error; }
}
async function payload(result: Response, guard?: Guard): Promise<unknown> {
  try { const value: unknown = await result.json(); checkedAdminGuard(guard)?.(); return value; } catch (error) { checkedAdminGuard(guard)?.(); throw error; }
}
async function detailRequest(session: Session, path: string, init: RequestInit | undefined, failure: string, guard?: Guard, witness?: Witness): Promise<AdminCustomerDetail> {
  const result = await response(session, path, init, guard, witness); if (result.status !== 200) throw new AdminCustomerDetailApiException(failure);
  const value = await payload(result, guard); try { return adminCustomerDetailFromJson(value); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminCustomerDetail */
export const adminCustomerDetail = (session: Session, ref: string, guard?: Guard, witness?: Witness) => detailRequest(session, pathRef('/v1/mobile/admin/customers/detail', ref), undefined, 'Admin customer detail failed', guard, witness);
/** @v2 adminUpdateCustomerPhone */
export const adminUpdateCustomerPhone = (session: Session, ref: string, phone: string, guard?: Guard) => detailRequest(session, pathRef('/v1/mobile/admin/customers/phone', ref), write('PUT', { phone }), 'Admin customer phone update failed', guard);
/** @v2 adminRegenerateCustomerCode */
export const adminRegenerateCustomerCode = (session: Session, ref: string, guard?: Guard) => detailRequest(session, pathRef('/v1/mobile/admin/customers/code/regenerate', ref), { method: 'POST' }, 'Admin customer code regenerate failed', guard);
/** @v2 adminRemoveCustomer */
export async function adminRemoveCustomer(session: Session, ref: string, guard?: Guard): Promise<void> {
  const result = await response(session, pathRef('/v1/mobile/admin/customers/remove', ref), { method: 'DELETE' }, guard); if (result.status !== 200) throw new AdminCustomerDetailApiException('Admin customer remove failed');
}
async function itemMutation(session: Session, path: string, init: RequestInit, code: string, message: string, guard?: Guard): Promise<AdminCustomerDetail> {
  const result = await response(session, path, init, guard);
  if (result.status !== 200) { const error = await adminItemMutationError(result, code, message); checkedAdminGuard(guard)?.(); throw error; }
  const value = await payload(result, guard); try { return adminCustomerDetailFromJson(value); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminAssignCustomerItem */
export const adminAssignCustomerItem = (session: Session, ref: string, itemCode: string, guard?: Guard) => itemMutation(session, pathRef('/v1/mobile/admin/customers/items/add', ref), write('POST', { item_code: itemCode }), 'item_customer_add_failed', 'Customer itemga ulanmadi', guard);
/** @v2 adminRemoveCustomerItem */
export const adminRemoveCustomerItem = (session: Session, ref: string, itemCode: string, guard?: Guard) => itemMutation(session, `${pathRef('/v1/mobile/admin/customers/items/remove', ref)}&item_code=${dartQueryComponent(itemCode)}`, { method: 'DELETE' }, 'item_customer_remove_failed', 'Customer itemdan uzilmadi', guard);
/** @v2 adminItems; source all-pages200 read for the customer Add sheet, with opt-in owner checks. */
export async function readAdminCustomerAvailableItems(session: Session, guard: Guard, witness: Witness): Promise<SupplierItem[]> {
  const items: SupplierItem[] = [], check = checkedAdminGuard(guard)!;
  for (let offset = 0; ; offset += 200) {
    check(); const result = await response(session, `/v1/mobile/admin/items?limit=200${offset ? `&offset=${offset}` : ''}`, undefined, check, witness);
    if (result.status !== 200) throw new AdminCustomerDetailApiException('Admin items failed');
    const value = await payload(result, check); if (!Array.isArray(value)) throw new TypeError('Invalid customer items');
    let page: SupplierItem[]; try { page = value.map(supplierItemFromJson); } finally { check(); }
    items.push(...page); if (page.length < 200) return items;
  }
}
const materialAssignment = (assignment: AdminRoleAssignment, ref: string) => assignment.principal_role === 'material_taminotchi' && dartPartialLower(dartTrim(assignment.principal_ref)) === dartPartialLower(dartTrim(ref));
async function readRoles(session: Session, guard?: Guard, witness?: Witness): Promise<readonly AdminRoleAssignment[]> {
  try { return await adminRoleAssignments(session, guard, witness); }
  catch (error) { checkedAdminGuard(guard)?.(); if (error instanceof Error && error.message === 'Admin role assignments failed') throw new AdminCustomerDetailApiException(error.message); throw error; }
}
/** @v2 _adminMaterialTaminotchiDetailFromPayload */
async function materialPayload(session: Session, ref: string, value: unknown, guard?: Guard, witness?: Witness): Promise<AdminCustomerDetail> {
  const row = adminCustomerDetailObject(value); let detail = adminCustomerDetailFromJson(row); checkedAdminGuard(guard)?.();
  if (!Object.hasOwn(row, 'assigned_item_groups')) {
    const assignments = await readRoles(session, guard, witness); checkedAdminGuard(guard)?.();
    detail = Object.freeze({ ...detail, assigned_item_groups: Object.freeze(adminCustomerScopeValues(assignments.find(assignment => materialAssignment(assignment, ref))?.assigned_item_groups ?? [])) });
  }
  if (!Object.hasOwn(row, 'assigned_warehouses')) {
    const assignments = await adminWarehouseSettingsAssignments(session, '', guard, witness).catch(error => {
      checkedAdminGuard(guard)?.(); if (error instanceof Error && error.message === 'Admin warehouse assignments failed') throw new AdminCustomerDetailApiException(error.message); throw error;
    }); checkedAdminGuard(guard)?.();
    detail = Object.freeze({ ...detail, assigned_warehouses: Object.freeze(adminCustomerScopeValues(assignments.filter(assignment => assignment.principal_role === 'material_taminotchi' && dartPartialLower(dartTrim(assignment.principal_ref)) === dartPartialLower(dartTrim(ref))).map(assignment => assignment.warehouse))) });
  }
  checkedAdminGuard(guard)?.(); return detail;
}
async function materialRequest(session: Session, ref: string, path: string, init: RequestInit | undefined, failure: string, guard?: Guard, witness?: Witness): Promise<AdminCustomerDetail> {
  const result = await response(session, pathRef(path, ref), init, guard, witness); if (result.status !== 200) throw new AdminCustomerDetailApiException(failure);
  try { return await materialPayload(session, ref, await payload(result, guard), guard, witness); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminMaterialTaminotchiDetail */
export const adminMaterialTaminotchiDetail = (session: Session, ref: string, guard?: Guard, witness?: Witness) => materialRequest(session, ref, '/v1/mobile/admin/material-taminotchilar/detail', undefined, 'Admin material taminotchi detail failed', guard, witness);
/** @v2 adminUpdateMaterialTaminotchiPhone */
export const adminUpdateMaterialTaminotchiPhone = (session: Session, ref: string, phone: string, guard?: Guard, witness?: Witness) => materialRequest(session, ref, '/v1/mobile/admin/material-taminotchilar/phone', write('PUT', { phone }), 'Admin material taminotchi phone update failed', guard, witness);
/** @v2 adminRegenerateMaterialTaminotchiCode */
export const adminRegenerateMaterialTaminotchiCode = (session: Session, ref: string, guard?: Guard, witness?: Witness) => materialRequest(session, ref, '/v1/mobile/admin/material-taminotchilar/code/regenerate', { method: 'POST' }, 'Admin material taminotchi code regenerate failed', guard, witness);
/** @v2 adminUpsertRoleAssignment */
export async function adminCustomerUpsertRoleAssignment(session: Session, assignment: AdminRoleAssignment, guard?: Guard): Promise<AdminRoleAssignment> {
  checkedAdminGuard(guard)?.();
  if (assignment.assigned_apparatus.some(id => !isCanonicalApparatusId(id))) throw new MobileApiException({ code: 'apparatus_id_invalid', message: 'Canonical apparatus ID noto‘g‘ri' });
  const result = await response(session, '/v1/mobile/admin/role-assignments', write('PUT', { principal_role: assignment.principal_role, principal_ref: assignment.principal_ref, role_id: assignment.role_id,
    ...(assignment.assigned_apparatus.length ? { assigned_apparatus: assignment.assigned_apparatus } : {}), ...(assignment.assigned_item_groups.length ? { assigned_item_groups: assignment.assigned_item_groups } : {}) }), guard);
  if (result.status !== 200) { const error = await adminApiError(result, 'admin_role_assignment_save_failed', 'Role biriktirish saqlanmadi'); checkedAdminGuard(guard)?.(); throw error; }
  const value = await payload(result, guard); try { return adminRoleAssignmentFromJson(value); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminUpdateMaterialTaminotchiItemGroups */
export async function adminUpdateMaterialTaminotchiItemGroups(session: Session, ref: string, groups: readonly string[], guard?: Guard, witness?: Witness): Promise<AdminCustomerDetail> {
  checkedAdminGuard(guard)?.(); const normalized = adminCustomerScopeValues(groups);
  if (!normalized.length) throw new MobileApiException({ code: 'material_item_groups_required', message: 'Kamida bitta mahsulot guruhini tanlang' });
  const result = await response(session, pathRef('/v1/mobile/admin/material-taminotchilar/item-groups', dartTrim(ref)), write('PUT', { assigned_item_groups: normalized }), guard);
  if (result.status === 404) {
    const assignments = await readRoles(session, guard, witness); checkedAdminGuard(guard)?.(); const existing = assignments.find(assignment => materialAssignment(assignment, ref));
    await adminCustomerUpsertRoleAssignment(session, { principal_role: 'material_taminotchi', principal_ref: dartTrim(ref), role_id: !existing || !dartTrim(existing.role_id) ? 'material_taminotchi' : existing.role_id,
      assigned_apparatus: existing?.assigned_apparatus ?? [], assigned_item_groups: normalized }, guard); checkedAdminGuard(guard)?.();
    return adminMaterialTaminotchiDetail(session, ref, guard, witness);
  }
  if (result.status !== 200) { const error = await adminApiError(result, 'admin_material_item_groups_update_failed', 'Mahsulot guruhlari saqlanmadi'); checkedAdminGuard(guard)?.(); throw error; }
  try { return await materialPayload(session, ref, await payload(result, guard), guard, witness); } finally { checkedAdminGuard(guard)?.(); }
}
