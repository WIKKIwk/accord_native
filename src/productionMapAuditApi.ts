import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value).trim();
const integer = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite integer');
  return Math.trunc(value);
};

/** @v2 AdminProductionWorkflowAuditViolation */
export function productionWorkflowAuditViolationFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid workflow audit violation');
  return { code: text(row.code), order_id: text(row.order_id), subject: text(row.subject), detail: text(row.detail) };
}

/** @v2 AdminProductionWorkflowAuditReport */
export function productionWorkflowAuditReportFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid workflow audit report');
  return { ok: row.ok === true, total_violations: integer(row.total_violations), checked_order_count: integer(row.checked_order_count) ?? 0,
    checked_batch_count: integer(row.checked_batch_count) ?? 0, checked_session_count: integer(row.checked_session_count) ?? 0,
    violations: Array.isArray(row.violations) ? row.violations.filter(item => object(item)).map(productionWorkflowAuditViolationFromJson) : [] };
}

/** @v2 adminProductionMapAudit */
export async function adminProductionMapAudit(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/audit');
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_map_audit');
  }
  const payload = object(await response.json());
  if (!payload) throw new WorkerControlException('production_map_audit_invalid_response', 'Workflow audit javobi noto‘g‘ri');
  return productionWorkflowAuditReportFromJson(payload);
}
