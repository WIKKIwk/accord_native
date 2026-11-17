import type { AdminApparatus } from '../apparatusApi';
import { dartTrim } from '../shared/dartApparatus';
import { productionText } from '../shared/localization';
import type { productionMapSavedFromJson } from '../workerProductionMapSaved';
import type { OrderCardTone } from '../workerOrderAppearance';

export type MaterialSequenceOrder = ReturnType<typeof productionMapSavedFromJson>;
export type MaterialSequenceSnapshot = Record<string, any>;
const text = (value: unknown) => typeof value === 'string' ? dartTrim(value) : '';

/** @v2 productionMapPrintAssignmentAllowsOrder */
export function materialSequencePrintAllows(order: MaterialSequenceOrder, apparatus: AdminApparatus) {
  if (dartTrim(apparatus.operation).toLowerCase() !== 'print') return true;
  return order.map.nodes.some(node => {
    if (node.kind !== 'apparatus' || dartTrim(node.apparatus_id) !== dartTrim(apparatus.id)) return false;
    const group = dartTrim(node.alternative_group_id);
    if (!group) return true;
    const candidates = order.map.nodes.filter(candidate => candidate.kind === 'apparatus' && dartTrim(candidate.alternative_group_id) === group);
    return (candidates.length === 1 && !dartTrim(node.alternative_assigned_apparatus_id)) ||
      candidates.every(candidate => dartTrim(candidate.alternative_assigned_apparatus_id) === dartTrim(apparatus.id));
  });
}

/** @v2 productionMapLinearWorkStages: reachable physical occurrences, including alternative candidates. */
function workStages(order: MaterialSequenceOrder) {
  const { nodes, edges } = order.map, start = nodes.find(node => node.kind === 'start');
  if (!start) return [];
  const byId = new Map(nodes.map(node => [node.id, node])), pending = [start.id], seen = new Set<string>();
  const result: typeof nodes = [];
  for (let index = 0; index < pending.length; index++) {
    const node = byId.get(pending[index]);
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    const group = node.kind === 'apparatus' ? dartTrim(node.alternative_group_id) : '';
    const operation = group ? nodes.filter(candidate => candidate.kind === 'apparatus' && dartTrim(candidate.alternative_group_id) === group) : [node];
    for (const candidate of operation) if (candidate.kind === 'apparatus' && !result.includes(candidate)) result.push(candidate);
    const ids = new Set(operation.map(candidate => candidate.id));
    for (const edge of edges) {
      if (!ids.has(edge.from) || ids.has(edge.to)) continue;
      if (node.kind === 'condition' && !['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(dartTrim(edge.branch).toLowerCase())) continue;
      pending.push(edge.to);
    }
  }
  return result;
}

/** @v2 _productionMapOrdersForApparatus (supplyViewerMode, workerMode false). */
export function materialSequenceOrders(snapshot: MaterialSequenceSnapshot | null, apparatus: AdminApparatus | null,
  search = ''): MaterialSequenceOrder[] {
  if (!snapshot || !apparatus) return [];
  const maps: MaterialSequenceOrder[] = Array.isArray(snapshot.maps) ? snapshot.maps : [];
  const byId = new Map(maps.filter(order => order.map.id.startsWith('zakaz-') || order.map.id.startsWith('training-zakaz-'))
    .map(order => [dartTrim(order.map.id), order]));
  const visible: string[] = snapshot.visible_order_ids?.[apparatus.id] ?? [];
  const queueStates = snapshot.queue_states?.[apparatus.id] ?? {}, controls = snapshot.queue_action_controls?.[apparatus.id] ?? {};
  const values = visible.flatMap(id => {
    const order = byId.get(dartTrim(id));
    if (!order || !materialSequencePrintAllows(order, apparatus)) return [];
    const lifecycle = snapshot.order_statuses?.[order.map.id]?.lifecycle_status;
    if (['production_completed', 'closed', 'cancelled'].includes(lifecycle)) return [];
    const stages = workStages(order).filter(node => {
      const effective = !dartTrim(node.alternative_group_id) && dartTrim(node.alternative_assigned_apparatus_id)
        ? dartTrim(node.alternative_assigned_apparatus_id) : dartTrim(node.apparatus_id);
      return effective === apparatus.id;
    });
    const stageStates = snapshot.stage_states?.[order.map.id] ?? {}, control = controls[order.map.id];
    const completed = (id: string) => stageStates[id] === 'completed' ||
      (control?.stage_node_id === id && control?.stage_work?.local_completed === true);
    if (stages.length && stages.every(node => completed(node.id))) return [];
    if (stages.some(node => Object.hasOwn(stageStates, node.id) && !completed(node.id))) return [order];
    return queueStates[order.map.id] === 'completed' ? [] : [order];
  });
  const free = snapshot.queue_policies?.[apparatus.id]?.policy === 'free_pick';
  const ordered = free ? values : (() => {
    const index = new Map(values.map(order => [dartTrim(order.map.id), order])), seen = new Set<string>();
    const ids = [...(snapshot.sequences?.[apparatus.id] ?? []), ...values.map(order => order.map.id).reverse()];
    return ids.flatMap((id: string) => {
      const key = dartTrim(id), order = index.get(key);
      if (!order || seen.has(key)) return [];
      seen.add(key); return [order];
    });
  })();
  const query = dartTrim(search).toLowerCase();
  if (!query) return ordered;
  return ordered.filter(order => {
    const map = order.map;
    const customer = text(snapshot.order_customers?.[map.id]) || map.customer_name;
    return [materialSequenceCode(order), map.code, map.order_number, map.title, map.product_code, customer,
      ...map.nodes.map(node => node.title)].join(' ').toLowerCase().includes(query);
  });
}

export function materialSequenceCode(order: MaterialSequenceOrder) {
  const map = order.map;
  return dartTrim(map.code) || dartTrim(map.order_number) || (map.id.startsWith('zakaz-') ? dartTrim(map.id.slice(6)) : '');
}
export function materialSequencePresentation(order: MaterialSequenceOrder, snapshot: MaterialSequenceSnapshot | null, locale: string) {
  const map = order.map;
  return { code: materialSequenceCode(order), title: dartTrim(map.title) || productionText('worker.order.fallback', locale),
    subtitle: text(snapshot?.order_customers?.[map.id]) || dartTrim(map.customer_name) || dartTrim(map.product_code) };
}

/** @v2 _resolveApparatusOrderCardTone */
export function materialSequenceTone(order: MaterialSequenceOrder, snapshot: MaterialSequenceSnapshot | null, apparatus: AdminApparatus | null): OrderCardTone {
  if (!snapshot || !apparatus) return 'neutral';
  const id = order.map.id, status = snapshot.order_statuses?.[id], global = text(status?.order_status).toLowerCase();
  if (global === 'completed_with_issue' || status?.completed_with_issue_count > 0) return 'issue';
  if ((snapshot.order_controls?.[id] && snapshot.order_controls[id] !== 'active') || global === 'frozen') return 'frozen';
  let state = text(snapshot.queue_states?.[apparatus.id]?.[id]);
  const control = snapshot.queue_action_controls?.[apparatus.id]?.[id];
  if (state === 'completed') {
    const occurrences = workStages(order).filter(node => dartTrim(node.apparatus_id) === apparatus.id), states = snapshot.stage_states?.[id] ?? {};
    if (occurrences.length > 1 && occurrences.some(node => ['pending', 'print_preflight', 'in_progress', 'paused', 'frozen'].includes(states[node.id]) &&
      !(control?.stage_node_id === node.id && control?.stage_work?.local_completed === true))) state = 'pending';
  }
  if (state === 'print_preflight') {
    const hold = control?.print_preflight;
    return control?.state === state && hold?.status === 'passed' && text(hold.order_id) === id && text(hold.apparatus) === apparatus.id
      ? 'print_preflight_passed' : 'print_preflight';
  }
  return ['in_progress', 'paused', 'frozen', 'completed'].includes(state) ? state as OrderCardTone : 'neutral';
}
