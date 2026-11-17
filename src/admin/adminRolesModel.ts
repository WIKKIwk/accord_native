import type { AdminApparatus } from '../apparatusApi';
import { apparatusLabels } from '../rezka/rezkaWorkerController';
import { localizedGetter, localizedMethod } from '../shared/localization';
import { adminCustomerApparatusAssignment } from './adminCustomerApparatusModel';
import type { AdminSettings } from './adminSettings';
import type { AdminUserCreateCustomer, AdminUserCreateRole, adminUserCreateSupplierFromJson } from './adminUserCreateModel';
import type { AdminRoleAssignment, AdminUserPrincipalRole } from './adminUsersModel';
import { dartPartialLower, dartTrim } from './dartJsonString';

export type AdminRolesRole = AdminUserCreateRole;
export type AdminRolesCapability = Readonly<{ code: string; label: string; default_roles: readonly AdminUserPrincipalRole[] }>;
export type AdminRolesPrincipal = Readonly<{ role: AdminUserPrincipalRole; ref: string; name: string; icon: 'badge' | 'local_shipping' | 'precision_manufacturing' | 'person' }>;
export type AdminRolesData = Readonly<{ capabilities: readonly AdminRolesCapability[]; roles: readonly AdminRolesRole[]; assignments: readonly AdminRoleAssignment[];
  settings: AdminSettings; suppliers: readonly ReturnType<typeof adminUserCreateSupplierFromJson>[]; customers: readonly AdminUserCreateCustomer[]; apparatus: readonly AdminApparatus[] }>;

/** @v2 _AdminRolesData.principalsForDisplay */
export function adminRolesPrincipals(data: AdminRolesData, locale: string): readonly AdminRolesPrincipal[] {
  const rows: AdminRolesPrincipal[] = [{ role: 'werka', ref: 'werka', name: dartTrim(data.settings.werka_name) || localizedGetter('werkaRoleName', locale), icon: 'badge' },
    ...data.suppliers.map(item => ({ role: 'supplier' as const, ref: item.ref, name: item.name, icon: 'local_shipping' as const })),
    ...data.customers.map(item => {
      const assignment = adminCustomerApparatusAssignment(data.assignments, item.ref, false);
      const role = assignment && dartPartialLower(dartTrim(assignment.role_id)) === 'aparatchi' ? 'aparatchi' : assignment?.principal_role ?? 'customer';
      return { role, ref: item.ref, name: item.name, icon: role === 'aparatchi' ? 'precision_manufacturing' as const : 'person' as const };
    })];
  return Object.freeze(rows.filter(item => !!dartTrim(item.name)));
}
/** @v2 _AdminRolesData.assignmentForPrincipal */
export function adminRolesAssignment(data: AdminRolesData, principal: AdminRolesPrincipal): AdminRoleAssignment | null {
  return principal.role === 'customer' || principal.role === 'aparatchi' ? adminCustomerApparatusAssignment(data.assignments, principal.ref, false)
    : data.assignments.find(item => item.principal_role === principal.role && item.principal_ref === principal.ref) ?? null;
}
export function adminRolesAssignedRole(data: AdminRolesData, principal: AdminRolesPrincipal): AdminRolesRole | null {
  const assignment = adminRolesAssignment(data, principal);
  return data.roles.find(role => assignment ? role.id === assignment.role_id : role.system && role.base_role === principal.role && role.id === principal.role) ?? null;
}
/** @v2 _roleCanAssignToPrincipal */
export function adminRolesCanAssign(role: AdminRolesRole, principal: AdminRolesPrincipal): boolean {
  if (!role.system) return true;
  if (role.id === 'aparatchi') return principal.role === 'customer' || principal.role === 'aparatchi';
  if (role.id === 'qolipchi') return principal.role === 'qolipchi' || principal.role === 'aparatchi';
  if (role.id === 'boyoqchi') return principal.role === 'boyoqchi';
  return role.base_role === null || role.base_role === principal.role;
}
export const adminRolesNeedsApparatus = (role: AdminRolesRole) => role.capability_codes.includes('apparatus.queue.read');
/** @v2 _roleIdFromLabel */
export function adminRolesId(value: string): string {
  return dartPartialLower(dartTrim(value)).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_role';
}
export function adminRolesEditedRole(label: string, capabilities: readonly string[], role: AdminRolesRole | null): AdminRolesRole {
  return Object.freeze({ id: role?.id ?? adminRolesId(label), label: dartTrim(label), base_role: null, capability_codes: Object.freeze([...capabilities]), system: false });
}
/** @v2 _AdminRolesData.upsertRole */
export function adminRolesUpsertRole(data: AdminRolesData, role: AdminRolesRole): AdminRolesData {
  return { ...data, roles: Object.freeze([...data.roles.filter(item => item.id !== role.id), role].sort((left, right) =>
    left.system !== right.system ? left.system ? -1 : 1 : left.label < right.label ? -1 : left.label > right.label ? 1 : 0)) };
}
/** @v2 _AdminRolesData.upsertAssignment; source replaces every equal trimmed ref, regardless of principal role. */
export function adminRolesUpsertAssignment(data: AdminRolesData, assignment: AdminRoleAssignment): AdminRolesData {
  return { ...data, assignments: Object.freeze([...data.assignments.filter(item => dartTrim(item.principal_ref) !== dartTrim(assignment.principal_ref)), assignment]) };
}
export function adminRolesDraftAssignment(principal: AdminRolesPrincipal, role: AdminRolesRole, apparatus: readonly string[]): AdminRoleAssignment | null {
  if (!adminRolesCanAssign(role, principal) || (adminRolesNeedsApparatus(role) && apparatus.length === 0)) return null;
  return Object.freeze({ principal_role: ['aparatchi', 'qolipchi', 'boyoqchi'].includes(role.id) ? role.id as AdminUserPrincipalRole : principal.role,
    principal_ref: principal.ref, role_id: role.id, assigned_apparatus: Object.freeze(adminRolesNeedsApparatus(role) ? [...apparatus].sort() : []), assigned_item_groups: Object.freeze([]) });
}
export const adminRolesLabel = (role: AdminRolesRole, locale: string) => role.system ? localizedMethod('systemRoleLabel', locale, { id: role.id, fallback: role.label }) : role.label;
export const adminRolesCapabilityLabel = (code: string, capabilities: readonly AdminRolesCapability[], locale: string) =>
  localizedMethod('adminCapabilityLabel', locale, { code, fallback: capabilities.find(item => item.code === code)?.label ?? code });
export const adminRolesSummary = (role: AdminRolesRole, locale: string) => `${role.base_role === null ? '' : `${localizedMethod('roleLabelForCode', locale, { code: role.base_role })} • `}${localizedMethod('adminRoleKindLabel', locale, { system: role.system })}`;
export const adminRolesAssignmentSubtitle = (role: AdminRolesRole, locale: string) => role.base_role === null ? localizedMethod('adminRoleKindLabel', locale, { system: role.system }) : localizedMethod('roleLabelForCode', locale, { code: role.base_role });
export const adminRolesApparatusLabels = (assignment: AdminRoleAssignment | null, data: AdminRolesData) => apparatusLabels(assignment?.assigned_apparatus ?? [], data.apparatus);
