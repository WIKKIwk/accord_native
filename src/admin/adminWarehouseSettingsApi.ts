import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminWarehouseAssignments, type WarehouseAssignment } from '../shared/catalogApi';
import { MobileApiException } from '../shared/mobileApiException';
import { adminApiError } from './adminApiError';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminWarehouseAssignmentFromJson, type AdminWarehouseAssignmentInput } from './adminWarehouseAssignmentApi';
import { dartTrim } from './dartJsonString';

/** @v2 adminWarehouseAssignments
 * Scoped opt-in adapter; ordinary callers keep the existing shared API and parser behavior. */
export async function adminWarehouseSettingsAssignments(session: Session, warehouse = '', guard?: () => void,
  readWitness?: () => boolean): Promise<readonly WarehouseAssignment[]> {
  const check = checkedAdminGuard(guard);
  if (readWitness !== undefined && (typeof readWitness !== 'function' || !check)) throw new TypeError('Scoped warehouse assignments require a guard');
  if (!check) return adminWarehouseAssignments(session, warehouse);
  check(); const query = new URLSearchParams(), name = dartTrim(warehouse); if (name) query.set('warehouse', name);
  const suffix = query.toString(), path = `/v1/mobile/admin/warehouses/assignments${suffix ? `?${suffix}` : ''}`;
  try {
    const response = readWitness === undefined ? await authorizedFetch(session, path, undefined, check)
      : await authorizedFetch(session, path, undefined, check, 10_000, { readWitness }); check();
    if (response.status !== 200) throw new Error('Admin warehouse assignments failed');
    const value: unknown = await response.json(); check();
    try {
      if (!Array.isArray(value)) throw new TypeError('Invalid assignments');
      return Object.freeze(value.map(adminWarehouseAssignmentFromJson));
    } finally { check(); }
  } catch (error) { check(); throw error; }
}
/** @v2 adminUnassignWarehouse */
export async function adminUnassignWarehouse(session: Session, input: Omit<AdminWarehouseAssignmentInput, 'display_name'>,
  guard?: () => void): Promise<WarehouseAssignment> {
  const check = checkedAdminGuard(guard); check?.();
  const warehouse = dartTrim(input.warehouse), principal_ref = dartTrim(input.principal_ref);
  if (!warehouse || !principal_ref) throw new MobileApiException({ code: 'warehouse_assignment_input_required', message: 'Ombor assignment ma’lumoti to‘liq emas' });
  try {
    const response = await authorizedFetch(session, '/v1/mobile/admin/warehouses/assignments', { method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warehouse, principal_role: input.principal_role, principal_ref }) }, check);
    check?.();
    if (response.status !== 200) { const error = await adminApiError(response, 'warehouse_assignment_remove_failed', 'Ombor assignmenti olib tashlanmadi'); check?.(); throw error; }
    const value: unknown = await response.json(); check?.();
    try {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid warehouse assignment envelope');
      return adminWarehouseAssignmentFromJson((value as Record<string, unknown>).assignment);
    } finally { check?.(); }
  } catch (error) { check?.(); throw error; }
}
