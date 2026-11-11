import type { Session } from './auth';
import { isCanonicalApparatusId, WorkerControlException } from './workerControlsApi';
import { completedQueueOrderFromJson, parseApparatusSequenceMap, parseApparatusQueueStateMap, parseApparatusQueuePolicyMap,
  parseProductionMapSnapshotRevisionFromJson, completionRequestNotification, productionOrderStatusDetail,
  productionMapSequenceRevisions, productionMapStringMap } from './workerQueueModels';
import { queueActionControlState } from './workerQueueAction';
import { productionMapSavedFromJson } from './workerProductionMapSaved';
import { calculateOrderTemplateFromJson } from './workerOpenedOrderEditApi';
import { completionRequestDecisionFromJson } from './productionCompletionApi';
import { decodeWorkerListSnapshot } from './workerSnapshot';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const fail = (detail: string): never => { throw new WorkerControlException('production_map_snapshot_contract_invalid',
  `Production map navbati server shartnomasiga mos emas: ${detail}`); };
const text = (value: unknown): string => value == null ? '' : String(value);
const integer = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite timestamp');
  return Math.trunc(value);
};
const canonical = (value: unknown): string => {
  const id = text(value).trim();
  if (!isCanonicalApparatusId(id)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return id;
};
const knownStates = new Set(['pending', 'print_preflight', 'in_progress', 'paused', 'frozen', 'completed']);

/** @v2 AdminFrozenQueueOrder */
export function frozenQueueOrderFromJson(value: unknown, fallbackApparatus = '') {
  const row = object(value); if (!row) throw new TypeError('Invalid frozen queue order');
  return { apparatus: canonical(text(row.apparatus).trim() || fallbackApparatus), order_id: text(row.order_id),
    issue_note: text(row.issue_note), frozen_at_unix: integer(row.frozen_at_unix), frozen_by: text(row.frozen_by) };
}

/** @v2 AdminStageOrderControl */
export function stageOrderControlFromJson(value: unknown) {
  const row = object(value), request = object(row?.freeze_request);
  if (!row || typeof row.order_id !== 'string' || !row.order_id.trim() || typeof row.stage_node_id !== 'string' || !row.stage_node_id.trim() ||
      !['active', 'freeze_requested', 'frozen'].includes(row.state)) return fail('invalid stage order control');
  if (typeof request?.target_apparatus !== 'string' || !isCanonicalApparatusId(request.target_apparatus)) return fail('invalid stage control apparatus');
  return { order_id: row.order_id, stage_node_id: row.stage_node_id, state: row.state,
    apparatus: request.target_apparatus, payload: { ...row } };
}

function requireStringLists(raw: unknown, field: string): void {
  const value = object(raw); if (!value) return fail(`${field} must be an object`);
  for (const [apparatus, ids] of Object.entries(value)) {
    if (!isCanonicalApparatusId(apparatus.trim()) || !Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim())) {
      return fail(`${field} contains an invalid item`);
    }
  }
}
function requireQueueStates(raw: unknown): void {
  const value = object(raw); if (!value) return fail('queue_states must be an object');
  for (const [apparatus, rawStates] of Object.entries(value)) {
    const states = object(rawStates);
    if (!isCanonicalApparatusId(apparatus.trim()) || !states) return fail('queue_states contains an invalid apparatus');
    if (Object.entries(states).some(([id, state]) => !id.trim() || typeof state !== 'string' || !knownStates.has(state.trim().toLowerCase()))) {
      return fail('queue_states contains an unknown order state');
    }
  }
}
function sequencePositions(raw: unknown, visible: Record<string, string[]>): Obj {
  if (raw === undefined) return {};
  const positions = object(raw); if (!positions) return fail('sequence positions must be an object');
  for (const [apparatus, entries] of Object.entries(positions)) {
    const values = object(entries);
    if (!isCanonicalApparatusId(apparatus) || !values) return fail('invalid sequence position apparatus');
    const visibleIds = new Set(visible[apparatus] ?? []), ranks = Object.values(values);
    if (Object.keys(values).length !== visibleIds.size || new Set(ranks).size !== ranks.length ||
        Object.entries(values).some(([id, rank]) => !id.trim() || !visibleIds.has(id) || !Number.isInteger(rank) || (rank as number) <= 0)) {
      return fail('invalid sequence positions');
    }
  }
  return positions;
}
function stageStates(raw: unknown): Obj {
  const row = object(raw); if (!row) return {};
  const result: Obj = {};
  for (const [id, value] of Object.entries(row)) {
    const stages = object(value); if (!id.trim() || !stages) continue;
    result[id.trim()] = {};
    for (const [stage, state] of Object.entries(stages)) if (stage.trim()) {
      const normalized = String(state).trim().toLowerCase();
      if (!knownStates.has(normalized)) return fail('stage_states contains an invalid stage state');
      result[id.trim()][stage.trim()] = normalized;
    }
  }
  return result;
}
function frozenOrders(raw: unknown): Obj {
  const row = object(raw); if (!row) return fail('frozen_orders_by_apparatus must be an object');
  const result: Obj = {};
  for (const [key, value] of Object.entries(row)) {
    const station = key.trim();
    if (!isCanonicalApparatusId(station) || !Array.isArray(value)) return fail('frozen_orders_by_apparatus contains an invalid apparatus');
    const orders = value.filter(item => object(item)).map(item => frozenQueueOrderFromJson(item, station)).filter(item => item.order_id.trim());
    if (orders.some(item => item.apparatus.trim() !== station)) return fail('frozen_orders_by_apparatus contains an invalid order');
    if (orders.length) result[station] = orders;
  }
  return result;
}
/** @v2 _parseAdminQueueActionControls */
export function parseProductionQueueActionControls(raw: unknown, states: Obj, stages: Obj, session?: Session): Obj {
  const value = object(raw); if (!value) return fail('queue_action_controls must be an object');
  const result: Obj = {};
  for (const [apparatus, entries] of Object.entries(value)) {
    const station = apparatus.trim(), orders = object(entries);
    if (!isCanonicalApparatusId(station)) return fail('queue_action_controls contains an invalid apparatus key');
    if (!orders) return fail(`queue_action_controls[${station}] must be an object`);
    result[station] = {};
    for (const [orderId, rawControl] of Object.entries(orders)) {
      const control = object(rawControl), id = orderId.trim();
      if (!id || !control) return fail(`queue_action_controls[${station}] contains an invalid order`);
      const stationStates = object(states[station]);
      const queueState = stationStates && Object.hasOwn(stationStates, id) ? stationStates[id] : control.state;
      const normalized = queueActionControlState({ apparatus: station, order_id: id, queue_state: control.state,
        order_control: 'active', epoch: '__snapshot__', scope: '__snapshot__', rev: 0,
        stage_states: Object.hasOwn(stages, id) ? stages[id] : {}, control }, true, session);
      if (!normalized) return fail('queue_action_controls contains an invalid order control');
      if (typeof queueState === 'string' && queueState.trim() && queueState.trim().toLowerCase() !== normalized.control.state.trim().toLowerCase()) {
        return fail('queue state and action control state disagree');
      }
      Object.defineProperty(result[station], id, { value: normalized.control, enumerable: true, writable: true, configurable: true });
    }
  }
  return result;
}

// The full snapshot has additional projection branches beyond its queue controls.
export function decodeCanonicalProductionMapSnapshot(value: unknown, requireMaps = false, session?: Session): Obj {
  const row = object(value); if (!row) return fail('snapshot must be an object');
  if (row.projection === 'worker_list_v1') {
    const compact = decodeWorkerListSnapshot(row);
    const controls = object(compact.order_controls)!;
    return { ...compact, maps: [], queue_action_controls: {}, stage_states: {}, stage_order_controls: [],
      stage_freeze_supported: false, early_closing_order_ids: [], order_customers: {}, order_statuses: {},
      frozen_orders_by_apparatus: {}, calculation_templates: {},
      queue_policies: parseApparatusQueuePolicyMap(compact.queue_policies),
      order_controls: Object.fromEntries(Object.entries(controls).map(([id, control]) => [id.trim(), object(control)!.state])) };
  }
  const fullLive = Array.isArray(row.completed_orders) && Array.isArray(row.completion_requests) && Array.isArray(row.completion_request_decisions);
  const parseLiveLists = fullLive || requireMaps;
  if (row.projection != null && typeof row.projection !== 'string') throw new TypeError('Invalid snapshot projection');
  if (!Object.hasOwn(row, 'visible_order_ids') || row.visible_order_ids == null) {
    throw new WorkerControlException('production_map_visible_order_ids_missing', 'Production map navbati noto‘liq');
  }
  if ((requireMaps || fullLive) && (!Array.isArray(row.maps) || row.maps.some((item: unknown) => !object(item)))) return fail('maps must be an array');
  requireStringLists(row.sequences, 'sequences'); requireStringLists(row.visible_order_ids, 'visible_order_ids');
  const sequences = parseApparatusSequenceMap(row.sequences), visible = parseApparatusSequenceMap(row.visible_order_ids);
  requireQueueStates(row.queue_states);
  const queueStates = parseApparatusQueueStateMap(row.queue_states);
  if (!Array.isArray(row.queue_policies)) return fail('queue_policies must be an array');
  for (const value of row.queue_policies) {
    const policy = object(value);
    if (!policy || typeof policy.apparatus_id !== 'string' || !isCanonicalApparatusId(policy.apparatus_id.trim()) ||
        typeof policy.policy !== 'string' || !['strict_sequence', 'free_pick'].includes(policy.policy.trim())) return fail('queue_policies contains an invalid item');
  }
  const orderControls = object(row.order_controls); if (!orderControls) return fail('order_controls must be an object');
  for (const [id, value] of Object.entries(orderControls)) {
    const control = object(value);
    if (!id.trim() || !control || typeof control.state !== 'string' || !['active', 'freeze_requested', 'frozen'].includes(control.state.trim())) {
      return fail('order_controls contains an invalid item');
    }
  }
  const parsedStages = stageStates(row.stage_states), controls = parseProductionQueueActionControls(row.queue_action_controls, queueStates, parsedStages, session);
  let stageControls: ReturnType<typeof stageOrderControlFromJson>[] = [];
  if (row.stage_order_controls != null) {
    if (!Array.isArray(row.stage_order_controls)) return fail('stage order controls must be a list');
    stageControls = row.stage_order_controls.map(stageOrderControlFromJson);
    if (new Set(stageControls.map(item => JSON.stringify([item.order_id, item.stage_node_id]))).size !== stageControls.length) return fail('duplicate stage order control');
  }
  const maps: ReturnType<typeof productionMapSavedFromJson>[] = [];
  if (Array.isArray(row.maps)) for (const item of row.maps) if (object(item)) { try { maps.push(productionMapSavedFromJson(item)); } catch { /* skip corrupt map */ } }
  const templates: Obj = {};
  if (row.calculation_templates != null) {
    const rawTemplates = object(row.calculation_templates); if (!rawTemplates) return fail('invalid calculation templates');
    for (const [id, template] of Object.entries(rawTemplates)) {
      if (!id.trim() || !object(template)) return fail('invalid calculation templates');
      templates[id] = calculateOrderTemplateFromJson(template);
    }
  }
  const statuses: Obj = {};
  const rawStatuses = object(row.order_statuses);
  if (rawStatuses) for (const [id, value] of Object.entries(rawStatuses)) if (id.trim()) statuses[id.trim()] = productionOrderStatusDetail(value);
  const parsedControls = Object.fromEntries(Object.entries(orderControls).map(([id, value]) => [id.trim(), object(value)!.state.trim()]));
  const list = <T>(raw: unknown, decode: (value: unknown) => T): T[] => Array.isArray(raw) ? raw.map(decode) : [];
  return { ...row, projection: row.projection ?? '', sequences, visible_order_ids: visible, queue_states: queueStates, queue_policies: parseApparatusQueuePolicyMap(row.queue_policies),
    queue_action_controls: controls, stage_states: parsedStages, order_controls: parsedControls,
    stage_order_controls: stageControls, stage_freeze_supported: Array.isArray(row.stage_order_controls),
    early_closing_order_ids: Object.entries(orderControls).filter(([, value]) => object(object(value)?.early_close)).map(([id]) => id.trim()),
    order_customers: productionMapStringMap(row.order_customers), order_statuses: statuses, frozen_orders_by_apparatus: frozenOrders(row.frozen_orders_by_apparatus),
    sequence_versions: productionMapStringMap(row.sequence_versions), sequence_revisions: productionMapSequenceRevisions(row.sequence_revisions),
    sequence_positions_by_apparatus: sequencePositions(row.sequence_positions_by_apparatus, visible), maps, calculation_templates: templates,
    revision: parseProductionMapSnapshotRevisionFromJson(row), epoch: typeof row.epoch === 'string' ? row.epoch : '',
    scope: typeof row.scope === 'string' ? row.scope : '', worker_show_all_apparatus_tabs: row.worker_show_all_apparatus_tabs === true,
    completed_orders: parseLiveLists ? list(row.completed_orders, completedQueueOrderFromJson) : [],
    completion_requests: parseLiveLists ? list(row.completion_requests, completionRequestNotification) : [],
    completion_request_decisions: parseLiveLists ? list(row.completion_request_decisions, completionRequestDecisionFromJson) : [] };
}
