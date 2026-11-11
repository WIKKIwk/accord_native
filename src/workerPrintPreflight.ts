import type { Session } from './auth';
import { postWorkerApiRequest, printPreflightHold, WorkerControlException, type AdminPrintPreflightHold } from './workerControlsApi';
import { queueActionControlState } from './workerQueueAction';
export { printPreflightHold, type AdminPrintPreflightHold } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 AdminPrintPreflightResponse */
export type AdminPrintPreflightResponse = { hold: AdminPrintPreflightHold; control_state: Obj | null };
export function printPreflightResponse(raw: unknown, session?: Session): AdminPrintPreflightResponse {
  const payload = object(raw), hold = printPreflightHold(payload?.hold);
  if (!hold) throw new WorkerControlException('print_preflight_invalid_response', 'Rang sinovi javobi noto‘g‘ri');
  const state = object(payload?.control_state);
  let control: Obj | null = null;
  try {
    // The hold is already committed. Parse its optional action authority with
    // the same model as queue ACK/bootstrap; failure drops only that authority.
    control = queueActionControlState(state, false, session);
  } catch { /* V2 refreshes malformed optional controls read-only. */ }
  return { hold, control_state: control };
}

/** @v2 adminPrintPreflight */
export async function adminPrintPreflight(session: Session, input: {
  apparatus: string; order_id: string; action: string; hold_id?: string; idempotency_key?: string; expected_revision?: number | null;
}): Promise<AdminPrintPreflightResponse> {
  const hold = (input.hold_id ?? '').trim(), key = (input.idempotency_key ?? '').trim();
  const result = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/print-preflight', {
    apparatus: input.apparatus, order_id: input.order_id, action: input.action, include_control: true,
    ...(hold ? { hold_id: hold } : {}), ...(input.expected_revision != null ? { expected_revision: input.expected_revision } : {}),
    ...(key ? { idempotency_key: key } : {}),
  }, null, false, 'print_preflight_not_ready');
  return printPreflightResponse(result, session);
}
