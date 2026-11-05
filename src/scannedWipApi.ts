import type { Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { isCanonicalApparatusId, postWorkerApiRequest, WorkerControlException } from './workerControlsApi';

export interface ScannedWip {
  session_id: string; batch_id: string; qr_payload: string; source_apparatus: string; linked_at_unix: number;
  worker_display_name: string; state: string; consume_state: string; return_token: string | null; blocked_reason: string;
}
/** @v2 AdminScannedWip */
export function scannedWipFromJson(value: unknown): ScannedWip {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid scanned WIP');
  const row = value as Record<string, unknown>, token = row.return_token;
  if (['session_id', 'batch_id', 'qr_payload', 'source_apparatus', 'worker_display_name', 'blocked_reason'].some(k => typeof row[k] !== 'string') ||
      !row.session_id || !row.batch_id || !Number.isInteger(row.linked_at_unix) ||
      !['active', 'unprocessed', 'consumed', 'returned'].includes(row.state as string) ||
      !['unused', 'consumed', 'unknown'].includes(row.consume_state as string) ||
      (token != null && (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)))) throw new TypeError('Invalid scanned WIP');
  return { session_id: row.session_id as string, batch_id: row.batch_id as string, qr_payload: row.qr_payload as string,
    source_apparatus: row.source_apparatus as string, linked_at_unix: row.linked_at_unix as number,
    worker_display_name: row.worker_display_name as string, state: row.state as string, consume_state: row.consume_state as string,
    return_token: token == null ? null : token as string, blocked_reason: row.blocked_reason as string };
}
export function canReturnScannedWip(input: ScannedWip) {
  return input.consume_state === 'unused' && input.return_token !== null && ['active', 'unprocessed'].includes(input.state);
}

/** @v2 adminReturnScannedWip */
export async function adminReturnScannedWip(session: Session, apparatus: string, orderId: string, stageNodeId: string, input: ScannedWip) {
  const scope = sessionReadScope(session), machine = apparatus.trim();
  if (!isCanonicalApparatusId(machine)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  if (!canReturnScannedWip(input) || !orderId.trim() || !stageNodeId.trim()) throw new WorkerControlException('queue_action_not_allowed', '');
  const response = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/scanned-wips/return', {
    apparatus: machine, order_id: orderId.trim(), stage_node_id: stageNodeId.trim(), session_id: input.session_id,
    batch_id: input.batch_id, token: input.return_token,
  }, scope, true, 'queue_action_not_allowed');
  if (!response || typeof response !== 'object' || Array.isArray(response) || (response as { ok?: unknown }).ok !== true)
    throw new TypeError('Invalid WIP return response');
}
