import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { openingWipBatch } from './workerOpeningWip';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown): string => value == null ? '' : String(value).trim();
const integer = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite timestamp');
  return Math.trunc(value);
};

/** @v2 AdminOpeningWipIntake */
export function openingWipIntakeFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid opening WIP intake');
  const actor = object(row.actor) ?? {};
  return { intake_id: text(row.intake_id), idempotency_key: text(row.idempotency_key), order_id: text(row.order_id),
    entry_apparatus: text(row.entry_apparatus), source_operation: text(row.source_operation), source_apparatus: text(row.source_apparatus),
    current_location: text(row.current_location), resume_apparatus: text(row.resume_apparatus), resume_stage_node_id: text(row.resume_stage_node_id),
    history_status: text(row.history_status), status: text(row.status), note: text(row.note), actor_role: text(actor.role), actor_ref: text(actor.ref_),
    actor_display_name: text(actor.display_name), created_at_unix: integer(row.created_at_unix), updated_at_unix: integer(row.updated_at_unix) };
}
export function openingWipIntakeSourceStageNodeId(intake: ReturnType<typeof openingWipIntakeFromJson>): string {
  return intake.source_apparatus.trim() ? intake.resume_stage_node_id : '';
}

/** @v2 AdminOpeningWipRecord */
export function openingWipRecordFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid opening WIP record');
  if (row.batches != null && !Array.isArray(row.batches)) throw new TypeError('Invalid opening WIP batches');
  return { intake: openingWipIntakeFromJson(object(row.intake) ?? {}),
    batches: (row.batches as unknown[] | null | undefined ?? []).filter(item => object(item)).map(openingWipBatch) };
}

/** @v2 adminOpeningWipRecords */
export async function adminOpeningWipRecords(session: Session, input: { order_id?: string; status?: string; limit?: number } = {}) {
  const limit = Math.min(500, Math.max(1, Math.trunc(input.limit ?? 100)));
  const query = new URLSearchParams({ limit: String(limit) });
  if (input.order_id?.trim()) query.set('order_id', input.order_id.trim());
  if (input.status?.trim()) query.set('status', input.status.trim());
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/opening-wip?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'opening_wip_list');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid opening WIP response');
  if (payload.records != null && !Array.isArray(payload.records)) throw new TypeError('Invalid opening WIP records');
  return (payload.records as unknown[] | null | undefined ?? []).filter(item => object(item)).map(openingWipRecordFromJson);
}
