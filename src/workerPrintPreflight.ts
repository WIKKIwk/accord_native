import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { validOrderControl } from './workerOrderLogic';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value).trim();

/** @v2 AdminPrintPreflightHold */
export type AdminPrintPreflightHold = { hold_id: string; idempotency_key: string; order_id: string; apparatus: string;
  status: string; revision: number };
export function printPreflightHold(raw: unknown): AdminPrintPreflightHold | null {
  const value = object(raw);
  if (!value) return null;
  const hold_id = text(value.hold_id), idempotency_key = text(value.idempotency_key), order_id = text(value.order_id);
  const apparatus = text(value.apparatus), status = text(value.status).toLowerCase(), revision = value.revision ?? 0;
  if (!hold_id || !idempotency_key || !order_id || !apparatus || !Number.isInteger(revision) || (revision as number) < 0 ||
      !['held', 'running', 'passed', 'failed', 'cancelled', 'consumed'].includes(status)) return null;
  return { hold_id, idempotency_key, order_id, apparatus, status, revision: revision as number };
}

/** @v2 AdminPrintPreflightResponse */
export type AdminPrintPreflightResponse = { hold: AdminPrintPreflightHold; control_state: Obj | null };
export function printPreflightResponse(raw: unknown): AdminPrintPreflightResponse {
  const payload = object(raw), hold = printPreflightHold(payload?.hold);
  if (!hold) throw new WorkerControlException('print_preflight_invalid_response', 'Rang sinovi javobi noto‘g‘ri');
  const state = object(payload?.control_state);
  let control: Obj | null = null;
  if (state && typeof state.apparatus === 'string' && typeof state.order_id === 'string' && object(state.stage_states) &&
      validOrderControl({ ok: true, control_state: { ...state, scope: '__preflight__' } }, state.apparatus, state.order_id, null)) {
    control = state;
  }
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
  return printPreflightResponse(result);
}
