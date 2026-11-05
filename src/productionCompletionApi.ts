import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value);
const integer = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite timestamp');
  return Math.trunc(value);
};

/** @v2 AdminCompletionRequestDecisionNotification */
export function completionRequestDecisionFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid completion decision');
  const apparatus = text(row.apparatus).trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return { event_id: text(row.event_id), request_event_id: text(row.request_event_id), decision: text(row.decision), apparatus,
    order_id: text(row.order_id), order_number: text(row.order_number), order_title: text(row.order_title), product_code: text(row.product_code),
    worker_role: text(row.worker_role), worker_ref: text(row.worker_ref), worker_display_name: text(row.worker_display_name),
    decided_by_role: text(row.decided_by_role), decided_by_ref: text(row.decided_by_ref), decided_by_display_name: text(row.decided_by_display_name),
    description: text(row.description), message: text(row.message), created_at_unix: integer(row.created_at_unix) };
}

/** @v2 adminProductionMapCompletionRequestDecisions */
export async function adminProductionMapCompletionRequestDecisions(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/completion-request-decisions');
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'completion_request_decisions');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid completion decisions response');
  return Array.isArray(payload.completion_request_decisions) ? payload.completion_request_decisions.map(completionRequestDecisionFromJson) : [];
}
