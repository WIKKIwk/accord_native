import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { isCanonicalApparatusId, WorkerControlException } from '../workerControlsApi';
import { guardedRezkaRequest, type RezkaSessionSnapshot } from './rezkaSessionGuard';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
const string = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Expected a string');
  return value;
};
const list = (value: unknown): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Expected a list');
  return value;
};
const roles = new Set(['supplier', 'werka', 'customer', 'aparatchi', 'qolipchi', 'boyoqchi', 'tayyorlov_masteri',
  'material_taminotchi', 'admin', 'homashyo_rezkachi', 'sales_manager', 'brigader', 'rezka_master']);

/** @v2 AdminWorker */
export type RezkaWorker = { id: string; name: string; phone: string; level: string };
export function rezkaWorkerFromJson(value: unknown): RezkaWorker {
  const row = object(value);
  if (!row) throw new TypeError('Expected a worker');
  return { id: string(row.id), name: string(row.name), phone: string(row.phone).trim(), level: string(row.level) };
}

/** @v2 AdminRoleAssignment */
export type RezkaAssignment = { principal_role: string; principal_ref: string; role_id: string;
  assigned_apparatus: string[]; assigned_item_groups: string[] };
export function rezkaAssignmentFromJson(value: unknown): RezkaAssignment {
  const row = object(value);
  if (!row) throw new TypeError('Expected an assignment');
  const rawRole = string(row.principal_role).trim().toLowerCase();
  const role = rawRole === 'omborchi' ? 'werka' : rawRole;
  if (!roles.has(role)) throw new TypeError(`Unsupported user role: ${rawRole}`);
  const ids = list(row.assigned_apparatus).map(item => String(item).trim());
  if (ids.some(id => !isCanonicalApparatusId(id))) throw new TypeError('Canonical apparatus ID list is invalid');
  return { principal_role: role, principal_ref: string(row.principal_ref), role_id: string(row.role_id),
    assigned_apparatus: [...new Set(ids)], assigned_item_groups: list(row.assigned_item_groups).map(string) };
}

export class RezkaMasterException extends WorkerControlException {
  constructor(code: string, message: string, statusCode: number, readonly details: string[] = []) {
    super(code, message, statusCode);
  }
}
const messages: Record<string, string> = {
  warehouse_assignee_not_allowed: 'Bu rolga ombor biriktirishga server ruxsat bermadi',
  aasx_integrity_failed: 'Aparat AASX ma’lumotlari tekshirilmadi', apparatus_persistence_failed: 'Aparatlar bazadan yuklanmadi',
  apparatus_cutover_blocked: 'Aparatlar canonical ma’lumotlari tayyor emas', apparatus_projection_invalid: 'Aparat ma’lumotlari formati noto‘g‘ri',
  'worker phone already exists': 'Bu telefon raqami boshqa ishchiga biriktirilgan', 'worker not found': 'Ishchi topilmadi',
  'worker store failed': 'Ishchi telefoni bazaga saqlanmadi',
};
async function assertSuccess(response: Response, fallbackCode: string, fallbackMessage: string): Promise<void> {
  if (response.status === 200) return;
  let payload: JsonObject | null = null;
  try { payload = object(await response.json()); } catch { /* V2 falls back for non-JSON responses. */ }
  const value = typeof payload?.error === 'string' ? payload.error.trim() : '';
  const code = value || fallbackCode;
  const message = value ? messages[value.toLowerCase()] ?? value : `${fallbackMessage} (HTTP ${response.status})`;
  const details = code === 'rezka_worker_has_open_run' && Array.isArray(payload?.blocked_apparatus_ids)
    ? payload.blocked_apparatus_ids.filter((item): item is string => typeof item === 'string') : [];
  throw new RezkaMasterException(code, message, response.status, details);
}

/** @v2 rezkaMasterWorkers */
export async function rezkaMasterWorkers(session: Session, snapshot: RezkaSessionSnapshot): Promise<{ workers: RezkaWorker[]; assignments: RezkaAssignment[] }> {
  const response = await guardedRezkaRequest(session, 'master', snapshot, false, beforeSend =>
    authorizedFetch(session, '/v1/mobile/rezka-master/workers', {}, beforeSend));
  await assertSuccess(response, 'rezka_workers_load_failed', 'Rezka ishchilari yuklanmadi');
  const row = object(await response.json());
  if (!row || !Array.isArray(row.workers) || !Array.isArray(row.assignments)) throw new TypeError('Invalid Rezka worker response');
  return { workers: row.workers.map(rezkaWorkerFromJson), assignments: row.assignments.map(rezkaAssignmentFromJson) };
}

async function save(session: Session, path: string, body: JsonObject, snapshot: RezkaSessionSnapshot): Promise<void> {
  const response = await guardedRezkaRequest(session, 'master', snapshot, true, beforeSend =>
    authorizedFetch(session, `/v1/mobile/rezka-master/${path}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, beforeSend));
  await assertSuccess(response, 'rezka_settings_save_failed', 'Rezka sozlamalari saqlanmadi');
}

/** @v2 rezkaMasterAssignWorker */
export function rezkaMasterAssignWorker(session: Session, workerId: string, apparatusIds: string[], previousApparatusIds: string[],
  snapshot: RezkaSessionSnapshot): Promise<void> {
  return save(session, 'workers', { worker_id: workerId, apparatus_ids: apparatusIds, previous_apparatus_ids: previousApparatusIds }, snapshot);
}

/** @v2 rezkaMasterSaveOrderSettings */
export function rezkaMasterSaveOrderSettings(session: Session, orderId: string, duplicateLabels: boolean, includeBobina: boolean,
  previousDuplicateLabels: boolean, previousIncludeBobina: boolean, snapshot: RezkaSessionSnapshot): Promise<void> {
  return save(session, 'order-settings', { order_id: orderId, duplicate_rezka_labels: duplicateLabels, include_bobina_in_net: includeBobina,
    previous_duplicate_rezka_labels: previousDuplicateLabels, previous_include_bobina_in_net: previousIncludeBobina }, snapshot);
}
