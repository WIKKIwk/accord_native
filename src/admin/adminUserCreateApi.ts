import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminApiError } from './adminApiError';
import { adminCustomerDetailFromJson } from './adminCustomerDetailModel';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminWorkerDetailSystemPhoneFromJson } from './adminWorkerDetailModel';
import type { AdminUserPrincipalRole } from './adminUsersModel';
import { adminUserCreateCustomerFromJson, adminUserCreateRoleFromJson, adminUserCreateSupplierFromJson } from './adminUserCreateModel';
import { dartTrim } from './dartJsonString';

type Guard = () => void;
async function request<T>(session: Session, path: string, input: unknown | undefined, decode: (value: unknown) => T, fallback: string,
  guard: Guard, witness?: () => boolean, apiError?: string): Promise<T> {
  const check = checkedAdminGuard(guard)!; if (witness !== undefined && typeof witness !== 'function') throw new TypeError('Invalid create read witness'); check();
  const init = input === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) };
  try {
    const response = witness ? await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness }) : await authorizedFetch(session, path, init, check); check();
    if (response.status !== 200) { if (!apiError) throw new Error(fallback); const error = await adminApiError(response, apiError, 'Foydalanuvchi yaratilmadi'); check(); throw error; }
    const value: unknown = await response.json(); check(); try { return decode(value); } finally { check(); }
  } catch (error) { check(); throw error; }
}
export const readAdminUserCreateRoles = (session: Session, guard: Guard, witness: () => boolean) => request(session, '/v1/mobile/admin/roles', undefined, value => {
  if (!Array.isArray(value)) throw new TypeError('Invalid admin role list'); return Object.freeze(value.map(adminUserCreateRoleFromJson));
}, 'Admin roles failed', guard, witness);
export const createAdminUserCreateCustomer = (session: Session, name: string, phone: string, guard: Guard) => request(session, '/v1/mobile/admin/customers',
  { name, ...(dartTrim(phone) ? { phone: dartTrim(phone) } : {}) }, adminUserCreateCustomerFromJson, 'Admin customer create failed', guard, undefined, 'admin_customer_create_failed');
export const createAdminUserCreateSupplier = (session: Session, name: string, phone: string, guard: Guard) => request(session, '/v1/mobile/admin/suppliers', { name, phone }, adminUserCreateSupplierFromJson, 'Admin supplier create failed', guard);
export const createAdminUserCreateMaterial = (session: Session, name: string, phone: string, groups: readonly string[], guard: Guard) => request(session, '/v1/mobile/admin/material-taminotchilar',
  { name, phone, assigned_item_groups: groups }, adminCustomerDetailFromJson, 'Admin material taminotchi create failed', guard, undefined, 'admin_material_taminotchi_create_failed');
export async function createAdminUserCreateSystem(session: Session, role: AdminUserPrincipalRole, name: string, phone: string, guard: Guard) {
  checkedAdminGuard(guard)!();
  if (!['qolipchi', 'boyoqchi', 'tayyorlov_masteri', 'homashyo_rezkachi', 'sales_manager', 'brigader', 'rezka_master', 'metalayzer'].includes(role)) throw new Error('Unsupported system user role');
  return request(session, '/v1/mobile/admin/system-users', { role, name, phone }, adminWorkerDetailSystemPhoneFromJson, 'Admin system user create failed', guard);
}
