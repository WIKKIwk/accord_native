import { isCanonicalApparatusId, WorkerControlException } from './workerControlsApi';
import { apparatusQueuePolicy, completedQueueOrderFromJson, completionRequestNotification,
  productionMapSequenceRevisions, productionMapStringMap } from './workerQueueModels';
import { completionRequestDecisionFromJson } from './productionCompletionApi';

type Obj = Record<string, unknown>;
const asObject = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Obj : null;
const fail = (detail: string): never => { throw new WorkerControlException('production_map_snapshot_contract_invalid',
  `Production map navbati server shartnomasiga mos emas: ${detail}`); };
const queueStates = new Set(['pending', 'print_preflight', 'in_progress', 'paused', 'frozen', 'completed']);
const displayStates = new Set([...queueStates, 'print_preflight_passed', 'waiting_next_stage', 'issue']);
const forbidden = ['maps', 'stage_states', 'queue_action_controls', 'stage_order_controls', 'order_statuses',
  'frozen_orders_by_apparatus', 'calculation_templates', 'order_customers'];

function stringLists(raw: unknown, field: string): Record<string, string[]> {
  const input = asObject(raw);
  if (!input) return fail(`${field} must be an object`);
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isCanonicalApparatusId(key) || !Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
      return fail(`${field} contains an invalid item`);
    }
    result[key.trim()] = value.map(item => item.trim());
  }
  return result;
}

function nested(raw: unknown, field: string): Record<string, Obj> {
  const input = asObject(raw);
  if (!input) return fail(`${field} must be an object`);
  const result: Record<string, Obj> = {};
  for (const [key, value] of Object.entries(input)) {
    const entries = asObject(value);
    if (!isCanonicalApparatusId(key) || !entries || Object.keys(entries).some(id => !id.trim())) return fail(`invalid ${field} scope`);
    result[key] = entries;
  }
  return result;
}

/** Validates the compact worker projection before it can become a queue baseline. */
export function decodeWorkerListSnapshot(raw: unknown): Obj {
  const value = asObject(raw);
  if (!value || value.projection !== 'worker_list_v1' || forbidden.some(key => Object.hasOwn(value, key)) ||
      !Number.isInteger(value.rev) || (value.rev as number) < 0 || typeof value.epoch !== 'string' || !value.epoch ||
      typeof value.scope !== 'string' || !value.scope || !Array.isArray(value.queue_policies) ||
      !Array.isArray(value.completed_orders) || !Array.isArray(value.completion_requests) ||
      !Array.isArray(value.completion_request_decisions)) return fail('invalid worker list envelope');

  const rows = asObject(value.worker_list_rows);
  if (!rows) return fail('worker rows must be an object');
  for (const [id, rawRow] of Object.entries(rows)) {
    const row = asObject(rawRow);
    if (!row || row.id !== id || !id.trim() || ['code', 'title', 'customer_name', 'image_id'].some(key => typeof row[key] !== 'string')) {
      return fail('invalid worker row');
    }
    const paused = row.temporarily_paused_apparatus;
    if (paused != null && (!Array.isArray(paused) || paused.some(item => typeof item !== 'string' || !isCanonicalApparatusId(item)) ||
        new Set(paused).size !== paused.length)) return fail('invalid temporary pause display scope');
  }

  const sequences = stringLists(value.sequences, 'sequences');
  const visible = stringLists(value.visible_order_ids, 'visible_order_ids');
  const rawQueue = nested(value.queue_states, 'queue_states');
  const queue: Record<string, Record<string, string>> = {};
  for (const [machine, states] of Object.entries(rawQueue)) {
    const normalized: Record<string, string> = {};
    for (const [id, state] of Object.entries(states)) {
      if (typeof state !== 'string' || !queueStates.has(state.trim().toLowerCase())) return fail('invalid queue state');
      normalized[id.trim()] = state.trim().toLowerCase();
    }
    queue[machine.trim()] = normalized;
  }

  for (const item of value.queue_policies) {
    const policy = asObject(item);
    if (!policy || typeof policy.apparatus_id !== 'string' || !isCanonicalApparatusId(policy.apparatus_id) ||
        typeof policy.policy !== 'string' || !['strict_sequence', 'free_pick'].includes(policy.policy.trim()) ||
        (policy.source_revision != null && typeof policy.source_revision !== 'number')) return fail('invalid queue policy');
  }
  const controls = asObject(value.order_controls);
  if (!controls) return fail('invalid worker display control');
  for (const [id, rawControl] of Object.entries(controls)) {
    const control = asObject(rawControl);
    if (!id.trim() || !control || Object.keys(control).length !== 1 || typeof control.state !== 'string' ||
        !['active', 'freeze_requested', 'frozen'].includes(control.state)) return fail('invalid worker display control');
  }
  const display = nested(value.worker_display_states, 'worker_display_states');
  const prompts = nested(value.worker_report_prompts, 'worker_report_prompts');
  const pending = value.worker_pending_report_ids == null ? {} : stringLists(value.worker_pending_report_ids, 'worker_pending_report_ids');
  for (const [machine, states] of Object.entries(display)) {
    for (const [id, state] of Object.entries(states)) {
      if (!Object.hasOwn(rows, id) || typeof state !== 'string' || !displayStates.has(state)) return fail('invalid worker display membership');
    }
    if (!isCanonicalApparatusId(machine)) return fail('invalid worker display scope');
  }
  for (const [machine, entries] of Object.entries(prompts)) {
    for (const [id, rawPrompt] of Object.entries(entries)) {
      const prompt = asObject(rawPrompt);
      if (!Object.hasOwn(rows, id) || !prompt || typeof prompt.report_session_id !== 'string' || !prompt.report_session_id.trim() ||
          typeof prompt.upstream_title !== 'string') return fail('invalid worker report prompt');
    }
    if (!isCanonicalApparatusId(machine)) return fail('invalid worker report scope');
  }
  for (const ids of Object.values(pending)) {
    if (new Set(ids).size !== ids.length || ids.some(id => !Object.hasOwn(rows, id))) return fail('invalid pending worker report membership');
  }
  for (const [machine, ids] of Object.entries(visible)) {
    for (const id of ids) {
      if (!Object.hasOwn(rows, id) || display[machine]?.[id] == null || queue[machine]?.[id] == null) return fail('missing worker display state');
    }
  }
  for (const [id, rawRow] of Object.entries(rows)) {
    const row = rawRow as Obj;
    if (Array.isArray(row.temporarily_paused_apparatus) && row.temporarily_paused_apparatus.some(machine => queue[machine]?.[id] !== 'paused')) {
      return fail('temporary pause display state mismatch');
    }
  }
  for (const rawCompleted of value.completed_orders) {
    const completed = asObject(rawCompleted);
    if (!completed || typeof completed.apparatus !== 'string' || !isCanonicalApparatusId(completed.apparatus) ||
        !Object.hasOwn(rows, String(completed.order_id ?? '')) ||
        (completed.completed_at_unix != null && typeof completed.completed_at_unix !== 'number')) return fail('invalid completed worker row');
  }
  for (const rawNotification of [...value.completion_requests, ...value.completion_request_decisions]) {
    const notification = asObject(rawNotification);
    if (!notification || typeof notification.apparatus !== 'string' || !isCanonicalApparatusId(notification.apparatus) ||
        (notification.created_at_unix != null && typeof notification.created_at_unix !== 'number')) return fail('invalid worker notification');
  }
  const revisions = productionMapSequenceRevisions(value.sequence_revisions);
  let positions: Record<string, Obj> = {};
  if (value.sequence_positions_by_apparatus !== undefined) {
    positions = nested(value.sequence_positions_by_apparatus, 'sequence positions');
    for (const [machine, entries] of Object.entries(positions)) {
      const ids = visible[machine] ?? [], ranks = Object.values(entries);
      if (Object.keys(entries).length !== new Set(ids).size || new Set(ranks).size !== ranks.length ||
          Object.entries(entries).some(([id, rank]) => !ids.includes(id) || !Number.isInteger(rank) || (rank as number) <= 0)) {
        return fail('invalid sequence positions');
      }
    }
  }
  return { ...value, sequences, visible_order_ids: visible, queue_states: queue, worker_pending_report_ids: pending,
    sequence_versions: productionMapStringMap(value.sequence_versions), sequence_revisions: revisions,
    sequence_positions_by_apparatus: positions, revision: value.rev,
    worker_show_all_apparatus_tabs: value.worker_show_all_apparatus_tabs === true,
    queue_policies: value.queue_policies.map(apparatusQueuePolicy),
    completed_orders: value.completed_orders.map(completedQueueOrderFromJson),
    completion_requests: value.completion_requests.map(completionRequestNotification),
    completion_request_decisions: value.completion_request_decisions.map(completionRequestDecisionFromJson) };
}
