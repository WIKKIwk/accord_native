import { dartTrim } from '../shared/dartApparatus';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { orderDisplayPath } from '../workerApi';
import type { WipBatch } from '../workerWip';
import type { openingWipRecordFromJson } from '../workerOpeningWipRecordsApi';
import type { MaterialDetailOrder } from './materialTaskDetailSections';

type Map = MaterialDetailOrder['map'];
type Node = Map['nodes'][number];
type Stage = { nodeId: string; apparatusId: string | null };
export type MaterialStageWipFacts = { produced: number; waitingInput: number; inUseInput: number; processedInput: number };

function successors(map: Map, id: string) {
  const node = map.nodes.find(value => value.id === id);
  if (!node) return [];
  const group = node.kind === 'apparatus' ? dartTrim(node.alternative_group_id) : '';
  const operation = new Set(group ? map.nodes.filter(value => value.kind === 'apparatus' && dartTrim(value.alternative_group_id) === group)
    .map(value => value.id) : [id]);
  return map.edges.filter(edge => {
    if (!operation.has(edge.from) || operation.has(edge.to)) return false;
    const from = map.nodes.find(value => value.id === edge.from);
    return from && (from.kind !== 'condition' || ['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(dartTrim(edge.branch).toLowerCase()));
  }).map(edge => edge.to);
}

function stagesForNode(map: Map, node: Node): Stage[] {
  const group = node.kind === 'apparatus' ? dartTrim(node.alternative_group_id) : '';
  if (group) return map.nodes.filter(value => value.kind === 'apparatus' && dartTrim(value.alternative_group_id) === group && isCanonicalApparatusId(value.apparatus_id))
    .map(value => ({ nodeId: value.id, apparatusId: dartTrim(value.apparatus_id) }));
  if (node.kind !== 'apparatus') return [{ nodeId: node.id, apparatusId: null }];
  const apparatus = dartTrim(node.alternative_assigned_apparatus_id) || dartTrim(node.apparatus_id);
  return isCanonicalApparatusId(apparatus) ? [{ nodeId: node.id, apparatusId: apparatus }] : [];
}

/** @v2 productionMapLinearWorkStages */
export function materialMapWorkStages(map: Map): Stage[] {
  const start = map.nodes.find(node => node.kind === 'start');
  if (!start) return [];
  const pending = [start.id], visited = new Set<string>(), occurrences = new Set<string>(), result: Stage[] = [];
  const byId = new globalThis.Map(map.nodes.map(node => [node.id, node]));
  let seenApparatus = false;
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index];
    if (visited.has(id) || !map.nodes.find(node => node.id === id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node && (node.kind === 'apparatus' || (node.kind === 'task' && seenApparatus))) {
      const stages = stagesForNode(map, node);
      if (node.kind === 'apparatus' && stages.length) seenApparatus = true;
      for (const stage of stages) {
        const occurrence = dartTrim(stage.nodeId);
        if (occurrences.has(occurrence)) continue;
        occurrences.add(occurrence); result.push(stage);
      }
    }
    pending.push(...successors(map, id));
  }
  return result;
}

/** @v2 productionMapWipConsumerIds */
export function materialMapWipConsumers(map: Map, apparatus: string, stageNodeId: string, consumerNodeId = ''): string[] {
  const stages = materialMapWorkStages(map), station = dartTrim(apparatus), id = dartTrim(stageNodeId);
  const targets = map.nodes.filter(node => node.kind === 'apparatus' && (id ? node.id === id : !!station && dartTrim(node.apparatus_id) === station) &&
    stages.some(stage => stage.nodeId === node.id));
  if (targets.length !== 1) return [];
  const target = targets[0], group = dartTrim(target.alternative_group_id), consumer = dartTrim(consumerNodeId);
  if (consumer && consumer !== target.id && !(group && map.nodes.some(node => node.id === consumer && node.kind === 'apparatus' && dartTrim(node.alternative_group_id) === group))) return [];
  const candidates = [...new Set(stages.filter(stage => stage.apparatusId && (stage.nodeId === target.id ||
    (group && map.nodes.some(node => node.id === stage.nodeId && dartTrim(node.alternative_group_id) === group)))).map(stage => stage.apparatusId!))];
  return station && !candidates.includes(station) ? [] : candidates;
}

/** @v2 productionMapNextWorkStagesForNode */
export function materialMapNextStages(map: Map, stageNodeId: string): Stage[] {
  const stages = materialMapWorkStages(map), id = dartTrim(stageNodeId);
  if (!stages.some(stage => dartTrim(stage.nodeId) === id)) return [];
  const physical = new globalThis.Map(stages.filter(stage => stage.apparatusId !== null).map(stage => [dartTrim(stage.nodeId), stage]));
  const pending = successors(map, id), visited = new Set<string>(), found = new Set<string>(), result: Stage[] = [];
  for (let index = 0; index < pending.length; index++) {
    const nodeId = pending[index];
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = map.nodes.find(value => value.id === nodeId);
    if (!node || node.kind === 'end') continue;
    if (physical.has(dartTrim(nodeId))) {
      for (const stage of stagesForNode(map, node)) if (!found.has(dartTrim(stage.nodeId))) { found.add(dartTrim(stage.nodeId)); result.push(stage); }
    } else pending.push(...successors(map, nodeId));
  }
  return result;
}

/** @v2 _openingWipBatchesProducedByApparatus */
export function materialMapOpeningBatches(order: MaterialDetailOrder, records: ReturnType<typeof openingWipRecordFromJson>[]): WipBatch[] {
  return records.flatMap(record => {
    const { intake } = record, source = dartTrim(intake.source_apparatus) || dartTrim(intake.entry_apparatus);
    if (dartTrim(intake.order_id) !== dartTrim(order.map.id) || !source) return [];
    const stageId = dartTrim(intake.source_apparatus) ? intake.resume_stage_node_id : '';
    const next = materialMapNextStages(order.map, stageId);
    return record.batches.filter(batch => dartTrim(batch.wip_status).toLowerCase() !== 'void').map(batch => ({
      batch_id: batch.batch_id, qr_payload: batch.qr_payload, order_id: batch.order_id, apparatus: source,
      next_apparatus: dartTrim(batch.used_by_apparatus) || dartTrim(batch.processed_by_apparatus) || (next.length === 1 ? next[0].apparatusId ?? '' : ''),
      wip_status: batch.wip_status, payload_json: { stage_node_id: stageId },
    }));
  });
}

/** @v2 productionMapStageWipFacts */
export function materialMapStageFacts(map: Map, node: Node, batches: WipBatch[]): MaterialStageWipFacts {
  const result = { produced: 0, waitingInput: 0, inUseInput: 0, processedInput: 0 }, seen = new Set<string>();
  for (const batch of batches) {
    if (dartTrim(String(batch.order_id ?? '')) !== dartTrim(map.id) || batch.wip_status === 'void') continue;
    const key = dartTrim(String(batch.batch_id ?? '')) || dartTrim(String(batch.qr_payload ?? ''));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (materialMapWipConsumers(map, String(batch.apparatus ?? ''), String(batch.payload_json?.stage_node_id ?? ''), node.id).includes(dartTrim(node.apparatus_id))) result.produced++;
    if (!materialMapWipConsumers(map, String(batch.next_apparatus ?? ''), String(batch.payload_json?.next_stage_node_id ?? ''), node.id).includes(dartTrim(node.apparatus_id))) continue;
    const state = dartTrim(String(batch.wip_status ?? '')).toLowerCase();
    if (state === 'waiting') result.waitingInput++;
    if (state === 'in_use') result.inUseInput++;
    if (state === 'processed') result.processedInput++;
  }
  return result;
}

export type MaterialTaskMapSnapshot = Record<string, any>;
type Control = Record<string, any>;
const queueStates = new Set(['pending', 'in_progress', 'print_preflight', 'paused', 'frozen', 'completed']);
const queueState = (raw: unknown): string | null => typeof raw === 'string' && queueStates.has(dartTrim(raw).toLowerCase()) ? dartTrim(raw).toLowerCase() : null;
export function materialMapStation(node: Node) {
  return !dartTrim(node.alternative_group_id) && dartTrim(node.alternative_assigned_apparatus_id)
    ? dartTrim(node.alternative_assigned_apparatus_id) : dartTrim(node.apparatus_id);
}
const sameOperation = (map: Map, node: Node, id: string) => id === dartTrim(node.id) || !!dartTrim(node.alternative_group_id) &&
  map.nodes.some(candidate => dartTrim(candidate.id) === id && dartTrim(candidate.alternative_group_id) === dartTrim(node.alternative_group_id));

/** @v2 productionMapStageQueueState; a queue never lends state to a second machine occurrence. */
export function materialMapQueueState(map: Map, node: Node, snapshot?: MaterialTaskMapSnapshot | null) {
  if (node.kind !== 'apparatus') return queueState(snapshot?.stage_states?.[map.id]?.[dartTrim(node.id)]);
  const apparatus = materialMapStation(node), control = snapshot?.queue_action_controls?.[apparatus]?.[dartTrim(map.id)];
  const occurrence = dartTrim(String(control?.stage_node_id ?? ''));
  const stage = queueState(snapshot?.stage_states?.[map.id]?.[dartTrim(node.id)]);
  const unambiguous = map.nodes.filter(candidate => candidate.kind === 'apparatus' && dartTrim(candidate.apparatus_id) === apparatus).length === 1;
  const queue = occurrence ? sameOperation(map, node, occurrence) : unambiguous;
  const value = queue ? queueState(snapshot?.queue_states?.[apparatus]?.[dartTrim(map.id)] ?? control?.state) : null;
  return stage === 'pending' && ['in_progress', 'print_preflight', 'paused'].includes(value ?? '') ? value : stage ?? value;
}

/** Canonical snapshot controls have already passed V2's contract parser. This is display consistency only. */
function consistent(control: Control, orderControl: string, state: string | null) {
  if (state && state !== dartTrim(String(control.state ?? '')).toLowerCase()) return false;
  const mode = control.interaction?.mode, actions = control.allowed_actions;
  if (!Array.isArray(actions) || !control.interaction) return false;
  const globalRequest = orderControl === 'freeze_requested';
  if (orderControl === 'active' && ['frozen', 'freeze_requested'].includes(control.stage_control_state)) {
    if (!dartTrim(String(control.stage_node_id ?? ''))) return false;
    if (control.stage_control_state === 'freeze_requested' && (control.freeze_request?.scope !== 'stage' ||
      control.freeze_request?.stage_node_id !== control.stage_node_id)) return false;
    orderControl = control.stage_control_state;
  }
  if (orderControl === 'frozen') return mode === 'frozen' && actions.length === 0;
  if (orderControl === 'freeze_requested') return mode === 'freeze_requested' ? !!control.freeze_request : globalRequest && actions.length === 0 &&
    ['fresh_start_blocked', 'requeued_waiting', 'waiting_previous_stage', 'frozen', 'completed'].includes(mode);
  return mode !== 'frozen' && control.state !== 'frozen' && mode !== 'freeze_requested';
}

/** @v2 productionQueueDisplayStatus / productionMapStageDisplayStatus */
function displayStatus(map: Map, node: Node, state: string | null, facts: MaterialStageWipFacts, snapshot?: MaterialTaskMapSnapshot | null) {
  if (state === 'completed') return 'completed';
  const orderControl = snapshot?.order_controls?.[map.id] ?? 'active';
  if (orderControl === 'frozen') return 'frozen';
  let control: Control | null = snapshot?.queue_action_controls?.[materialMapStation(node)]?.[map.id] ?? null;
  const occurrence = dartTrim(String(control?.stage_node_id ?? ''));
  if (occurrence ? !sameOperation(map, node, occurrence) : map.nodes.filter(candidate => candidate.kind === 'apparatus' &&
    dartTrim(candidate.apparatus_id) === dartTrim(node.apparatus_id)).length > 1) control = null;
  let status = !state && !control ? 'unknown' : state ?? control?.state ?? 'pending';
  if (control && !consistent(control, orderControl, state)) status = 'unknown';
  else if (control) {
    const interaction = control.interaction;
    if (['requeued_ready', 'requeued_waiting'].includes(interaction?.mode)) status = interaction.mode;
    else if (status === 'pending') {
      const modes = [interaction?.previous_wip_mode, interaction?.opening_wip_mode];
      if (modes.includes('scan_required')) status = control.allowed_actions.includes('start') ? 'wip_ready' : 'wip_waiting';
      else if (modes.includes('waiting')) status = 'waiting_wip';
    } else if (status === 'print_preflight' && control.print_preflight?.status === 'passed') status = 'print_preflight_passed';
  }
  if (['pending', 'unknown', 'waiting_wip'].includes(status)) {
    if (facts.produced) return 'wip_produced';
    if (facts.inUseInput + facts.processedInput) return 'wip_received';
    if (facts.waitingInput) return 'wip_available';
  }
  return status;
}

/** @v2 live alternative choice, stage status and intro/completed map progress. No snapshot means task-detail unknown status. */
export function materialTaskMapRows(order: MaterialDetailOrder, batches: WipBatch[], snapshot?: MaterialTaskMapSnapshot | null) {
  const ranks: Record<string, number> = { in_progress: 6, print_preflight: 5, paused: 4, completed: 3, frozen: 2, pending: 1 };
  const nodes = orderDisplayPath(order.map).map(value => {
    let selected = value as Node;
    if (selected.kind === 'apparatus' && dartTrim(selected.alternative_group_id)) {
      for (const candidate of order.map.nodes.filter(node => node.kind === 'apparatus' && dartTrim(node.alternative_group_id) === dartTrim(selected.alternative_group_id))) {
        if ((ranks[materialMapQueueState(order.map, candidate, snapshot) ?? ''] ?? 0) >
          (ranks[materialMapQueueState(order.map, selected, snapshot) ?? ''] ?? 0)) selected = candidate;
      }
    }
    return selected;
  });
  const firstApparatus = nodes.findIndex(node => node.kind === 'apparatus');
  return nodes.map((node, index) => {
    const facts = materialMapStageFacts(order.map, node, batches), state = materialMapQueueState(order.map, node, snapshot);
    return { node, facts, apparatus: node.kind === 'apparatus' ? materialMapStation(node) : '',
      title: dartTrim(node.alternative_assigned_title) || dartTrim(node.title),
      completed: firstApparatus > 0 && index < firstApparatus || state === 'completed',
      status: displayStatus(order.map, node, state, facts, snapshot) };
  });
}
