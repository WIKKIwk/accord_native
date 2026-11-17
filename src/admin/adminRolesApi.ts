import type { Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { authorizedFetch } from '../authorizedFetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminSettings } from './adminSettings';
import { readAdminItemCreateCustomers } from './adminItemCreateCustomersApi';
import { readAdminUserCreateRoles } from './adminUserCreateApi';
import { adminUserCreateRoleFromJson, adminUserCreateSupplierFromJson } from './adminUserCreateModel';
import { adminUserPrincipalRoleFromJson } from './adminUsersModel';
import { adminRoleAssignments } from './adminUsersApi';
import type { AdminRolesCapability, AdminRolesData, AdminRolesRole } from './adminRolesModel';

export class AdminRolesApiException extends Error { toString() { return `Exception: ${this.message}`; } }
async function request<T>(session: Session, path: string, decode: (value: unknown) => T, failure: string, guard: () => void, witness?: () => boolean, body?: unknown): Promise<T> {
  const check = checkedAdminGuard(guard); if (!check || (witness !== undefined && typeof witness !== 'function')) throw TypeError('Original roles scope is required'); check();
  try {
    const init = body === undefined ? undefined : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const response = witness ? await authorizedFetch(session, path, init, check, 10_000, { readWitness: witness }) : await authorizedFetch(session, path, init, check); check();
    if (response.status !== 200) throw new AdminRolesApiException(failure); const value: unknown = await response.json(); check();
    try { return decode(value); } finally { check(); }
  } catch (error) { check(); throw error; }
}
/** @v2 AdminCapability */
export function adminRolesCapabilityFromJson(value: unknown): AdminRolesCapability {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw TypeError('Invalid capability');
  const row = value as Record<string, unknown>, text = (value: unknown) => { if (value == null) return ''; if (typeof value !== 'string') throw TypeError('Invalid capability string'); return value; };
  const roles = row.default_roles ?? []; if (!Array.isArray(roles)) throw TypeError('Invalid capability default roles');
  return Object.freeze({ code: text(row.code), label: text(row.label), default_roles: Object.freeze(roles.map(adminUserPrincipalRoleFromJson)) });
}
/** @v2 adminCapabilities */
export const adminRolesCapabilities = (session: Session, guard: () => void, witness: () => boolean) => request(session, '/v1/mobile/admin/capabilities', value => {
  if (!Array.isArray(value)) throw TypeError('Invalid capability list'); return Object.freeze(value.map(adminRolesCapabilityFromJson));
}, 'Admin capabilities failed', guard, witness);
/** @v2 adminSuppliers; source Roles fetches one page of100. */
export const adminRolesSuppliers = (session: Session, guard: () => void, witness: () => boolean) => request(session, '/v1/mobile/admin/suppliers/list?limit=100', value => {
  if (!Array.isArray(value)) throw TypeError('Invalid supplier list'); return Object.freeze(value.map(adminUserCreateSupplierFromJson));
}, 'Admin suppliers failed', guard, witness);
/** @v2 adminUpsertRole */
export const adminRolesSave = (session: Session, role: AdminRolesRole, guard: () => void) => request(session, '/v1/mobile/admin/roles', adminUserCreateRoleFromJson,
  'Admin role save failed', guard, undefined, { id: role.id, label: role.label, capability_codes: role.capability_codes, ...(role.base_role === null ? {} : { base_role: role.base_role }) });
/** @v2 _AdminRolesScreenState._fetch */
export async function adminRolesFetch(session: Session, guard: () => void, witness: () => boolean): Promise<AdminRolesData> {
  const reads = [
    adminRolesCapabilities(session, guard, witness), readAdminUserCreateRoles(session, guard, witness), adminRoleAssignments(session, guard, witness),
    adminSettings(session, guard, witness), adminRolesSuppliers(session, guard, witness), readAdminItemCreateCustomers(session, { limit: 100 }, guard, witness),
    adminApparatus(session, { limit: 200, beforeSend: guard, readWitness: witness }),
  ] as const;
  let failed = false, firstError: unknown;
  // Dart Future.wait defaults to eagerError:false: retain the first failure,
  // but do not complete the batch while any other source request is pending.
  await Promise.allSettled(reads.map(read => read.catch(error => { if (!failed) { failed = true; firstError = error; } throw error; })));
  guard(); if (failed) throw firstError;
  const [capabilities, roles, assignments, settings, suppliers, customers, apparatus] = await Promise.all(reads);
  guard(); return Object.freeze({ capabilities, roles, assignments, settings, suppliers, customers, apparatus });
}
