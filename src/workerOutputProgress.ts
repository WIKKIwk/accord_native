import type { Session } from './auth';
import { isCanonicalApparatusId } from './workerControlsApi';
import { wipMeters, type WipBatch } from './workerWip';
export type WorkerOutputProgressProps = { session: Session; orderId: string; apparatusId: string; stageId: string;
  map: Record<string, unknown>; operation?: string; outputRevision?: string | number };
type Node = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const objects = (value: unknown): Node[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const group = (node: Node) => node.kind === 'apparatus' ? text(node.alternative_group_id) : '';
function apparatus(node: Node) {
  const id = !group(node) && text(node.alternative_assigned_apparatus_id) ? text(node.alternative_assigned_apparatus_id) : text(node.apparatus_id);
  return isCanonicalApparatusId(id) ? id : '';
}

/** Reachability and alternative occurrences from V2 productionMapLinearWorkStages. */
function workStages(map: Record<string, unknown>) {
  const nodes = objects(map.nodes), edges = objects(map.edges), byId = new Map(nodes.map(node => [text(node.id), node]));
  const start = nodes.find(node => node.kind === 'start');
  if (!start) return [];
  const queue = [text(start.id)], seen = new Set<string>(), result: Node[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i], node = byId.get(id);
    if (!node || seen.has(id)) continue;
    seen.add(id);
    const operation = group(node) ? nodes.filter(candidate => group(candidate) === group(node)) : [node];
    for (const candidate of operation) if (candidate.kind === 'apparatus' && apparatus(candidate) && !result.includes(candidate)) result.push(candidate);
    const operationIds = new Set(operation.map(candidate => text(candidate.id)));
    for (const edge of edges) {
      if (!operationIds.has(text(edge.from)) || operationIds.has(text(edge.to))) continue;
      const branch = text(edge.branch).toLowerCase();
      if (node.kind === 'condition' && !['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(branch)) continue;
      queue.push(text(edge.to));
    }
  }
  return result;
}

/** @v2 productionMapWipConsumerIds */
export function workerWipConsumerIds(map: Record<string, unknown>, nextApparatus: string, nextStageNodeId: string, consumerStageNodeId = ''): string[] {
  const stages = workStages(map), nodes = objects(map.nodes), station = nextApparatus.trim(), stage = nextStageNodeId.trim();
  const targets = nodes.filter(node => node.kind === 'apparatus' && (stage ? node.id === stage : !!station && text(node.apparatus_id) === station) && stages.some(candidate => candidate.id === node.id));
  if (targets.length !== 1) return [];
  const target = targets[0], alternatives = group(target), consumer = consumerStageNodeId.trim();
  if (consumer && consumer !== target.id && !(alternatives && nodes.some(node => node.id === consumer && node.kind === 'apparatus' && group(node) === alternatives))) return [];
  const candidates = [...new Set(stages.filter(node => node.id === target.id || (!!alternatives && group(node) === alternatives)).map(apparatus).filter(Boolean))];
  return station && !candidates.includes(station) ? [] : candidates;
}
/** @v2 productionMapNextWorkStagesForNode */
export function workerNextWorkStages(map: Record<string, unknown>, source: string): { id: string; apparatus: string }[] {
  const stages = workStages(map), nodes = objects(map.nodes), edges = objects(map.edges);
  if (!stages.some(node => node.id === source.trim())) return [];
  const successors = (id: string) => {
    const node = nodes.find(candidate => candidate.id === id);
    if (!node) return [];
    const operation = group(node) ? nodes.filter(candidate => group(candidate) === group(node)) : [node];
    const ids = new Set(operation.map(candidate => candidate.id));
    return edges.filter(edge => ids.has(edge.from) && !ids.has(edge.to) && (node.kind !== 'condition' ||
      ['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(text(edge.branch).toLowerCase()))).map(edge => text(edge.to));
  };
  const pending = successors(source.trim()), seen = new Set<string>(), found = new Set<string>(), result: { id: string; apparatus: string }[] = [];
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index], node = nodes.find(candidate => candidate.id === id);
    if (!node || seen.has(id) || node.kind === 'end') continue;
    seen.add(id);
    if (stages.some(candidate => candidate.id === id)) {
      for (const candidate of stages.filter(candidate => candidate.id === id || (!!group(node) && group(candidate) === group(node)))) {
        const key = text(candidate.id);
        if (!found.has(key)) { found.add(key); result.push({ id: key, apparatus: apparatus(candidate) }); }
      }
    } else pending.push(...successors(id));
  }
  return result;
}
/** @v2 _workerOrderPlannedMeters */
export function workerOrderPlannedMeters(base: unknown): number | null {
  return typeof base === 'number' && Number.isFinite(base) && base > 0 ? Math.ceil(base / 500) * 500 : null;
}
export function workerOutputStage(map: Record<string, unknown>, apparatusId: string, stageId: string) {
  const matches = workStages(map).filter(node => stageId ? node.id === stageId : apparatus(node) === apparatusId);
  return matches.length === 1 ? text(matches[0].id) : '';
}
/** @v2 _workerStageOutputMeters */
export function workerStageOutputMeters(map: Record<string, unknown>, orderId: string, stageId: string, batches: WipBatch[]) {
  const latest = new Map<string, WipBatch>();
  for (const batch of batches) {
    if (batch.order_id !== orderId || !batch.batch_id) continue;
    const previous = latest.get(batch.batch_id);
    if (!previous || batch.revision > previous.revision) latest.set(batch.batch_id, batch);
  }
  let units = 0, known = 0, missing = 0;
  for (const batch of latest.values()) {
    if (['void', 'peremotka'].includes(batch.wip_status) || batch.payload_json?.origin === 'layer_remainder') continue;
    const output = (batch.action === 'pause' && ['paused', 'resumed'].includes(batch.status)) ||
      (batch.action === 'detach_roll' && ['roll_detached', 'resumed'].includes(batch.status)) ||
      (['roll_complete', 'complete'].includes(batch.action) && batch.status === 'completed');
    if (!output || !workerWipConsumerIds(map, batch.apparatus, text(batch.payload_json?.stage_node_id), stageId).includes(batch.apparatus.trim())) continue;
    const meters = wipMeters(batch);
    if (meters === null) missing++;
    else { units += Math.round(meters * 1_000_000); known++; }
  }
  return { meters: units / 1_000_000, known, missing };
}
