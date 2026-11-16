import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { WarehouseAssignment } from '../shared/catalogApi';
import { adminApiError } from './adminApiError';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminUserPrincipalRoleFromJson, type AdminUserPrincipalRole } from './adminUsersModel';
import { dartJsonString, dartTrim } from './dartJsonString';

/** @v2 AdminWarehouseAssignment.fromJson
 * Assignment fields use Dart toString rather than the user list's strict strings. */
export function adminWarehouseAssignmentFromJson(value: unknown): WarehouseAssignment {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid warehouse assignment');
  const row = value as Record<string, unknown>, text = (item: unknown) => item == null ? '' : dartJsonString(item);
  return { warehouse: text(row.warehouse), principal_role: adminUserPrincipalRoleFromJson(text(row.principal_role)),
    principal_ref: text(row.principal_ref), display_name: text(row.display_name) };
}
export type AdminWarehouseAssignmentInput = { warehouse: string; principal_role: AdminUserPrincipalRole; principal_ref: string; display_name: string };
/** @v2 adminAssignWarehouse */
export async function adminAssignWarehouse(session: Session, input: AdminWarehouseAssignmentInput, guard?: () => void): Promise<WarehouseAssignment> {
  const check = checkedAdminGuard(guard); check?.();
  const warehouse = dartTrim(input.warehouse), principal_ref = dartTrim(input.principal_ref);
  if (!warehouse || !principal_ref) throw new Error('Admin warehouse assignment input required');
  const payload = { warehouse, principal_role: input.principal_role, principal_ref, display_name: dartTrim(input.display_name) };
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/warehouses/assignments', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, check);
    check?.();
    if (response.status !== 200) {
      const error = await adminApiError(response, 'warehouse_assignment_failed', 'Ombor biriktirilmadi'); check?.(); throw error;
    }
    const value: unknown = await response.json(); check?.();
    try { return adminWarehouseAssignmentFromJson(value); } finally { check?.(); }
  } catch (error) { check?.(); throw error; }
}
