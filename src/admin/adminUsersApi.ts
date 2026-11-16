import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { checkedAdminGuard } from './adminProductionRequest';
import { adminRoleAssignmentFromJson, adminUserListPageFromJson, type AdminRoleAssignment, type AdminUserListPage } from './adminUsersModel';
import { dartTrim } from './dartJsonString';

async function read(session: Session, path: string, fallback: string, guard?: () => void, readWitness?: () => boolean): Promise<unknown> {
  const check = checkedAdminGuard(guard);
  if (readWitness !== undefined && (typeof readWitness !== 'function' || !check)) throw new TypeError('Scoped admin users read requires a guard and witness');
  check?.();
  try {
    const response = readWitness === undefined ? await authorizedFetch(session, path, undefined, check)
      : await authorizedFetch(session, path, undefined, check, 10_000, { readWitness });
    check?.();
    if (response.status !== 200) throw new Error(fallback);
    const value: unknown = await response.json(); check?.(); return value;
  } catch (error) { check?.(); throw error; }
}
export type AdminUserListOptions = { query?: string; limit?: number; offset?: number; role?: string };
/** @v2 adminUserList; live wire is unchanged between f119 and 052. Test-mode demo routing stays deferred. */
export async function adminUserList(session: Session, options: AdminUserListOptions = {}, guard?: () => void,
  readWitness?: () => boolean): Promise<AdminUserListPage> {
  const query = new URLSearchParams(), q = dartTrim(options.query ?? ''), role = dartTrim(options.role ?? '');
  const limit = options.limit ?? 20, offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || !Number.isInteger(offset)) throw new TypeError('Invalid admin users pagination');
  if (q) query.set('q', q);
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  if (role) query.set('role', role);
  const suffix = query.toString();
  const data = await read(session, `/v1/mobile/admin/users/list${suffix ? `?${suffix}` : ''}`, 'Admin user list failed', guard, readWitness);
  try { return adminUserListPageFromJson(data); } finally { checkedAdminGuard(guard)?.(); }
}
/** @v2 adminRoleAssignments */
export async function adminRoleAssignments(session: Session, guard?: () => void, readWitness?: () => boolean): Promise<readonly AdminRoleAssignment[]> {
  const data = await read(session, '/v1/mobile/admin/role-assignments', 'Admin role assignments failed', guard, readWitness);
  try {
    if (!Array.isArray(data)) throw new TypeError('Invalid admin role assignments');
    return Object.freeze(data.map(adminRoleAssignmentFromJson));
  } finally { checkedAdminGuard(guard)?.(); }
}
