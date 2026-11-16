import { isCanonicalApparatusId } from '../workerControlsApi';
import { rezkaWorkerFromJson } from '../rezka/rezkaMasterApi';
import { apparatusLabels } from '../rezka/rezkaWorkerController';
import { progressBatchFromJson } from '../workerProgressBatch';
import { productionOrderLogFromJson } from '../workerClosedOrders';
import type { AdminApparatus } from '../apparatusApi';
import { adminUserPrincipalRoleFromJson, type AdminUserListEntry, type AdminUserPrincipalRole } from './adminUsersModel';
import { dartJsonString, dartPartialLower, dartTrim } from './dartJsonString';

type ObjectValue = Record<string, unknown>;
const objectOrNull = (value: unknown): ObjectValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
export function adminWorkerDetailObject(value: unknown): ObjectValue { const row = objectOrNull(value); if (!row) throw new TypeError('Invalid worker detail object'); return row; }
const text = (value: unknown, fallback = '') => { if (value == null) return fallback; if (typeof value !== 'string') throw new TypeError('Invalid worker detail string'); return value; };
const bool = (value: unknown) => { if (value == null) return false; if (typeof value !== 'boolean') throw new TypeError('Invalid worker detail boolean'); return value; };
const integer = (value: unknown, fallback = 0) => { if (value == null) return fallback; if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('Invalid worker detail integer'); return value; };
const list = (value: unknown): readonly unknown[] => { if (value == null) return []; if (!Array.isArray(value)) throw new TypeError('Invalid worker detail list'); return value; };
const converted = (value: unknown) => value == null ? '' : dartJsonString(value);
function apparatusId(value: unknown): string { const id = dartTrim(converted(value)); if (!isCanonicalApparatusId(id)) throw new TypeError('Canonical apparatus ID is required'); return id; }
/** @v2 AdminWorkerDetail */
export type AdminWorkerDetail = Readonly<{ id: string; name: string; phone: string; avatar_url: string; level: string; code: string; code_locked: boolean; code_retry_after_sec: number }>;
export function adminWorkerDetailFromJson(value: unknown): AdminWorkerDetail {
  const row = adminWorkerDetailObject(value); return Object.freeze({ id: text(row.id), name: text(row.name), phone: text(row.phone), avatar_url: text(row.avatar_url), level: text(row.level),
    code: text(row.code), code_locked: bool(row.code_locked), code_retry_after_sec: integer(row.code_retry_after_sec) });
}
/** @v2 AdminSystemUserDetail */
export type AdminWorkerDetailSystemUser = Readonly<Omit<AdminWorkerDetail, 'level'> & { role: AdminUserPrincipalRole; blocked: boolean }>;
export function adminWorkerDetailSystemFromJson(value: unknown): AdminWorkerDetailSystemUser {
  const row = adminWorkerDetailObject(value);
  return Object.freeze({ id: text(row.id), name: text(row.name), phone: text(row.phone), avatar_url: text(row.avatar_url), code: text(row.code),
    code_locked: bool(row.code_locked), code_retry_after_sec: integer(row.code_retry_after_sec), role: adminUserPrincipalRoleFromJson(row.role), blocked: bool(row.blocked) });
}
/** @v2 AdminSystemUser */
export function adminWorkerDetailSystemPhoneFromJson(value: unknown) {
  const row = adminWorkerDetailObject(value); return Object.freeze({ id: text(row.id), role: adminUserPrincipalRoleFromJson(row.role), name: text(row.name), phone: text(row.phone) });
}
/** @v2 AdminWorker
 * Retains the existing Rezka parser; the Admin adapter restores Dart's NEXT LINE trim semantics. */
export function adminWorkerDetailWorkerFromJson(value: unknown) { const row = rezkaWorkerFromJson(value); return Object.freeze({ ...row, phone: dartTrim(row.phone) }); }
/** @v2 AdminWorkerGroup */
export function adminWorkerDetailGroupFromJson(value: unknown) {
  const row = adminWorkerDetailObject(value);
  return Object.freeze({ apparatus: text(row.apparatus), apparatus_id: apparatusId(row.apparatus_id), group_code: text(row.group_code), shift: text(row.shift),
    start_time: text(row.start_time, '08:00'), end_time: text(row.end_time, '20:00'), work_days_per_week: integer(row.work_days_per_week, 6), start_day: text(row.start_day, 'monday'),
    accounting_enabled: row.accounting_enabled === true, worker_ids: Object.freeze(list(row.worker_ids).filter((id): id is string => typeof id === 'string')),
    workers: Object.freeze(list(row.workers).filter(item => objectOrNull(item) !== null).map(adminWorkerDetailWorkerFromJson)) });
}
/** @v2 AdminWorkerRunSession */
export function adminWorkerDetailRunFromJson(value: unknown) {
  const row = adminWorkerDetailObject(value), number = (value: unknown) => {
    if (value == null) return 0; if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid worker run timestamp'); return Math.trunc(value);
  };
  return Object.freeze({ session_id: converted(row.session_id), apparatus: apparatusId(row.apparatus), order_id: converted(row.order_id), status: converted(row.status),
    worker_role: converted(row.worker_role), worker_ref: converted(row.worker_ref), worker_display_name: converted(row.worker_display_name),
    started_at_unix: number(row.started_at_unix), updated_at_unix: number(row.updated_at_unix), payload_json: Object.freeze({ ...objectOrNull(row.payload_json) }) });
}
/** @v2 AdminWorkerProfileDetail */
export type AdminWorkerDetailProfile = ReturnType<typeof adminWorkerDetailProfileFromJson>;
export function adminWorkerDetailProfileFromJson(value: unknown) {
  const row = adminWorkerDetailObject(value);
  return Object.freeze({ worker: adminWorkerDetailFromJson(row.worker ?? {}), assigned_apparatus: Object.freeze([...new Set(list(row.assigned_apparatus).map(apparatusId))]),
    assigned_groups: Object.freeze(list(row.assigned_groups).map(adminWorkerDetailGroupFromJson)), active_sessions: Object.freeze(list(row.active_sessions).map(adminWorkerDetailRunFromJson)),
    recent_batches: Object.freeze(list(row.recent_batches).map(item => progressBatchFromJson(item))), recent_logs: Object.freeze(list(row.recent_logs).map(productionOrderLogFromJson)) });
}
/** @v2 _isSystemUser
 * current052 includes Metalayzer without broadening authentication or existing role defaults. */
export const adminWorkerDetailIsSystem = (entry: AdminUserListEntry) => ['qolipchi', 'boyoqchi', 'tayyorlovMasteri', 'homashyoRezkachi', 'salesManager', 'brigader', 'rezkaMaster', 'metalayzer'].includes(entry.kind);
export const adminWorkerDetailIsPreparation = (entry: AdminUserListEntry) => entry.kind === 'tayyorlovMasteri' || entry.principal_role === 'tayyorlov_masteri';
export const adminWorkerDetailWarehouseEnabled = (entry: AdminUserListEntry, readOnly: boolean) => !readOnly && (entry.kind === 'qolipchi' || entry.principal_role === 'qolipchi' || ['tayyorlovMasteri', 'homashyoRezkachi', 'metalayzer'].includes(entry.kind));
export function adminWorkerDetailWarehouseRole(entry: AdminUserListEntry): AdminUserPrincipalRole {
  return entry.kind === 'metalayzer' ? 'metalayzer' : entry.kind === 'homashyoRezkachi' ? 'homashyo_rezkachi' : entry.kind === 'qolipchi' || entry.principal_role === 'qolipchi' ? 'qolipchi' : 'tayyorlov_masteri';
}
/** @v2 normalizeAdminWarehouseNames */
export function adminWorkerDetailWarehouseNames(values: readonly string[]): readonly string[] {
  const byKey = new Map<string, string>(); for (const value of values) { const name = dartTrim(value), key = dartPartialLower(name); if (name && !byKey.has(key)) byKey.set(key, name); }
  return Object.freeze([...byKey.values()].sort((a, b) => { const l = dartPartialLower(a), r = dartPartialLower(b); return l < r ? -1 : l > r ? 1 : 0; }));
}
/** @v2 _WorkerAssignmentSummaryCard */
export function adminWorkerDetailApparatusLabels(profile: AdminWorkerDetailProfile | null, apparatus: readonly AdminApparatus[]): readonly string[] {
  return apparatusLabels([...(profile?.assigned_apparatus ?? []), ...(profile?.assigned_groups.map(group => group.apparatus_id) ?? [])], apparatus);
}
