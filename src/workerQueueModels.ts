import { isCanonicalApparatusId, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value);
const integer = (value: unknown) => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid queue model integer');
  return Math.trunc(value);
};
const invalid = (detail: string) => new WorkerControlException('production_map_snapshot_contract_invalid',
  `Production map navbati server shartnomasiga mos emas: ${detail}`);
const states = new Set(['pending', 'print_preflight', 'in_progress', 'paused', 'frozen', 'completed']);

/** @v2 AdminCompletedQueueOrder */
export function completedQueueOrderFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid completed queue order');
  const apparatus = text(row.apparatus).trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return { apparatus, order_id: text(row.order_id), completed_at_unix: integer(row.completed_at_unix),
    status: text(row.status).trim() || 'completed', issue_note: text(row.issue_note) };
}

export function productionMapStringMap(raw: unknown): Record<string, string> {
  const row = object(raw);
  if (!row) return {};
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), String(value).trim()])
    .filter(([key, value]) => key && value));
}

export function productionMapSequenceRevisions(raw: unknown): Record<string, number> {
  if (raw == null) return {};
  const row = object(raw);
  if (!row) throw invalid('invalid sequence revisions');
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null) continue;
    if (!Number.isInteger(value) || (value as number) < 0) throw invalid('invalid sequence revision');
    result[key] = value as number;
  }
  return result;
}

/** @v2 parseProductionMapSnapshotRevision */
export function parseProductionMapSnapshotRevision(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Invalid queue revision');
    return Math.trunc(value);
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^[+-]?(?:\d+|0x[0-9a-f]+)$/i.test(normalized)) return null;
  const sign = normalized.startsWith('-') ? -1 : 1;
  const unsigned = normalized.replace(/^[+-]/, '');
  const parsed = sign * Number(unsigned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** @v2 parseProductionMapSnapshotRevisionFromJson */
export function parseProductionMapSnapshotRevisionFromJson(value: Obj): number | null {
  const rev = parseProductionMapSnapshotRevision(value.rev);
  return rev ?? parseProductionMapSnapshotRevision(value.revision);
}

/** @v2 parseApparatusSequenceMap */
export function parseApparatusSequenceMap(raw: unknown): Record<string, string[]> {
  const input = object(raw);
  if (!input) return {};
  const result: Record<string, string[]> = {};
  for (const [rawId, rawOrders] of Object.entries(input)) {
    const id = rawId.trim();
    if (!isCanonicalApparatusId(id) || !Array.isArray(rawOrders)) throw invalid('sequences contains an invalid apparatus');
    const orders = rawOrders.map(value => String(value).trim());
    if (orders.some(value => !value)) throw invalid('sequences contains an invalid order');
    result[id] = orders;
  }
  return result;
}

/** @v2 parseApparatusQueueStateMap */
export function parseApparatusQueueStateMap(raw: unknown): Record<string, Record<string, string>> {
  const input = object(raw);
  if (!input) return {};
  const result: Record<string, Record<string, string>> = {};
  for (const [rawId, rawStates] of Object.entries(input)) {
    const id = rawId.trim(), rows = object(rawStates);
    if (!isCanonicalApparatusId(id) || !rows) throw invalid('queue_states contains an invalid apparatus');
    result[id] = {};
    for (const [rawOrder, rawState] of Object.entries(rows)) {
      const order = rawOrder.trim(), state = String(rawState).trim().toLowerCase();
      if (!order || !states.has(state)) throw invalid('queue_states contains an invalid order state');
      result[id][order] = state;
    }
  }
  return result;
}

/** @v2 AdminApparatusQueuePolicy */
export function apparatusQueuePolicy(raw: unknown): Obj {
  const row = object(raw);
  if (!row) throw invalid('queue_policies contains an invalid item');
  const id = text(row.apparatus_id).trim();
  if (!isCanonicalApparatusId(id)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return { apparatus_id: id, apparatus: text(row.apparatus), source_revision: integer(row.source_revision),
    source_aasx_sha256: text(row.source_aasx_sha256).trim(),
    policy: text(row.discipline ?? row.policy).trim() === 'free_pick' ? 'free_pick' : 'strict_sequence',
    locked: row.locked === true, reason: text(row.reason) };
}

/** @v2 parseApparatusQueuePolicyMap */
export function parseApparatusQueuePolicyMap(raw: unknown): Record<string, Obj> {
  const entries = Array.isArray(raw) ? raw : Object.values(object(raw) ?? {});
  const result: Record<string, Obj> = {};
  for (const entry of entries) {
    const parsed = apparatusQueuePolicy(entry);
    result[parsed.apparatus_id as string] = parsed;
  }
  return result;
}

/** @v2 AdminQueueWorkActivity */
export function queueWorkActivity(raw: unknown): { worker_role: string; worker_ref: string; state: string } | null {
  const row = object(raw);
  if (typeof row?.worker_role !== 'string' || typeof row.worker_ref !== 'string' || typeof row.state !== 'string') return null;
  const role = row.worker_role.trim(), ref = row.worker_ref.trim(), state = row.state.trim();
  return role && ref && ['in_progress', 'paused'].includes(state) ? { worker_role: role, worker_ref: ref, state } : null;
}

/** @v2 AdminProductionOrderStatusDetail */
export function productionOrderStatusDetail(raw: unknown): Obj {
  const row = object(raw) ?? {};
  return { lifecycle_status: text(row.lifecycle_status), order_status: text(row.order_status), work_status: text(row.work_status),
    flow_status: text(row.flow_status), stock_status: text(row.stock_status), completed_with_issue_count: integer(row.completed_with_issue_count) };
}

/** @v2 AdminCompletionRequestNotification */
export function completionRequestNotification(raw: unknown): Obj {
  const row = object(raw);
  if (!row) throw new TypeError('Invalid completion request');
  const apparatus = text(row.apparatus).trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const result: Obj = { apparatus };
  for (const key of ['event_id', 'order_id', 'order_number', 'order_title', 'product_code', 'worker_role',
    'worker_ref', 'worker_display_name', 'description']) result[key] = text(row[key]);
  result.zero_metric_codes = Array.isArray(row.zero_metric_codes) ? row.zero_metric_codes.map(value => String(value).trim()).filter(Boolean) : [];
  result.notice_kind = row.notice_kind == null ? 'completion_request' : text(row.notice_kind);
  result.decision_required = typeof row.decision_required === 'boolean' ? row.decision_required : true;
  result.created_at_unix = integer(row.created_at_unix);
  return result;
}
