import { activeSessionToken, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { adminReactivateCompletedWork, adminWorkReactivationPreview, isCanonicalApparatusId, type AdminWorkReactivationTarget } from './workerControlsApi';

type Obj = Record<string, any>;
type Text = (key: string, values?: Record<string, unknown>) => string;
export type WorkerWipReactivationInput = {
  apparatus: { id: string; name: string; operation: string }; map: Obj;
  batch?: { batch_id: string; qr_payload?: string }; workerMode: boolean; allowReactivation: boolean;
};
export type WorkerWipReactivationReview = {
  target: AdminWorkReactivationTarget | null; reason: string; stage: string; identity: string;
  actionKey: string; explanationKey: string;
};
export type WorkerWipReactivationOutcome = { attempted: boolean; succeeded: boolean; reason: string };
type Proof = { current: () => boolean; map: Obj; signature: string; pending?: Promise<WorkerWipReactivationOutcome> };
const reviews = new WeakMap<WorkerWipReactivationReview, Proof>();
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const first = (values: unknown[]) => values.map(text).find(Boolean) ?? '';
const nodesOf = (map: Obj): Obj[] => Array.isArray(map.nodes) ? map.nodes.filter((node: unknown) => node && typeof node === 'object') : [];

/** Physical occurrence order from productionMapLinearWorkStages (task-only stages do not affect this list). */
function apparatusOccurrences(map: Obj, apparatus: string): Obj[] {
  const nodes = nodesOf(map), byId = new Map(nodes.map(node => [node.id, node])), start = nodes.find(node => node.kind === 'start');
  if (!start) return [];
  const group = (node: Obj) => node.kind === 'apparatus' ? text(node.alternative_group_id) : '';
  const firstNode = (id: string) => nodes.find(node => node.id === id);
  const pending = [start.id], visited = new Set<string>(), seen = new Set<string>(), result: Obj[] = [];
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index], firstNodeAtId = firstNode(id), node = byId.get(id);
    if (visited.has(id) || !firstNodeAtId || !node) continue;
    visited.add(id);
    const candidates = group(node) ? nodes.filter(candidate => group(candidate) === group(node)) : [node];
    for (const candidate of candidates) {
      const station = group(candidate) || !text(candidate.alternative_assigned_apparatus_id)
        ? text(candidate.apparatus_id) : text(candidate.alternative_assigned_apparatus_id);
      const occurrence = text(candidate.id);
      if (candidate.kind !== 'apparatus' || !isCanonicalApparatusId(station) || !occurrence || seen.has(occurrence)) continue;
      seen.add(occurrence);
      if (station === apparatus) result.push(candidate);
    }
    const operation = group(firstNodeAtId) ? nodes.filter(candidate => group(candidate) === group(firstNodeAtId)) : [firstNodeAtId];
    const operationIds = new Set(operation.map(candidate => candidate.id));
    for (const edge of Array.isArray(map.edges) ? map.edges : []) {
      if (!operationIds.has(edge.from) || operationIds.has(edge.to)) continue;
      const from = firstNode(edge.from);
      if (!from || from.kind === 'condition' && !['ha', 'yes', 'true', '1', "yo'q", 'yoq', 'no', 'false', '0'].includes(text(edge.branch).toLowerCase())) continue;
      pending.push(edge.to);
    }
  }
  return result;
}

export function workerReactivationDenialKey(reason: string): string {
  return `worker.reactivate.reason.${['apparatus_busy', 'source_not_free', 'final_stage_closed', 'stale_target',
    'resource_unavailable', 'order_closed', 'unsupported_history'].includes(reason) ? reason : 'unavailable'}`;
}

/** @v2 _showWorkerWorkReactivation: preview and review model, before the user's explicit confirmation. */
export async function prepareWorkerWipReactivation(session: Session, input: WorkerWipReactivationInput, p: Text,
  current: () => boolean): Promise<WorkerWipReactivationReview | null> {
  const operation = text(input.apparatus.operation), lamination = ['laminate', 'glue'].includes(operation.toLowerCase());
  if (!input.workerMode || !input.allowReactivation || !['aparatchi', 'rezka_master'].includes(String(session.profile.role)) ||
      (input.batch ? !lamination && operation !== 'cut' : operation !== 'print')) return null;
  const scope = sessionReadScope(session), alive = () => current() && !!activeSessionToken(session) && scope === sessionReadScope(session);
  if (!alive()) return null;
  const map = input.map, order = typeof map.id === 'string' ? map.id : '', apparatus = input.apparatus.id;
  const batch = input.batch?.batch_id ?? '', isLamination = !!input.batch && lamination;
  const actionKey = isLamination ? 'worker.reactivate.lamination_action' : input.batch ? 'worker.reactivate.wip_action' : 'worker.reactivate.order_action';
  const explanationKey = isLamination ? 'worker.reactivate.lamination_explanation' : input.batch ? 'worker.reactivate.wip_explanation' : 'worker.reactivate.order_explanation';
  let target: AdminWorkReactivationTarget | null = null, reason = 'unavailable';
  if (Array.isArray(map.nodes) && order && (!input.batch || batch)) {
    try {
      const preview = await adminWorkReactivationPreview(session, apparatus, order, batch);
      if (!alive()) return null;
      target = preview.target; reason = preview.available ? '' : preview.denial_reason;
    } catch { /* An unavailable or old server never enables the action. */ }
  }
  if (!alive()) return null;
  const matching = target ? nodesOf(map).filter(node => node.id === target!.stage_node_id && node.kind === 'apparatus' && node.apparatus_id === apparatus) : [];
  if (target && matching.length !== 1) { target = null; reason = 'stale_target'; }
  const occurrences = apparatusOccurrences(map, apparatus), occurrence = occurrences.findIndex(node => node.id === target?.stage_node_id);
  const stage = matching.length === 1 ? `${first([matching[0].title, input.apparatus.name])}${occurrences.length > 1 && occurrence >= 0 ? ` (${occurrence + 1}/${occurrences.length})` : ''}` : '';
  const identity = [first([map.order_number, map.code, map.title, map.id]), input.apparatus.name,
    target ? p('worker.reactivate.stage', { stage }) : '', input.batch ? first([input.batch.qr_payload, input.batch.batch_id]) : ''].filter(value => value.trim()).join('\n');
  const review: WorkerWipReactivationReview = { target, reason, stage, identity, actionKey, explanationKey };
  reviews.set(review, { current: alive, map, signature: JSON.stringify({ target: review.target, map }) });
  return review;
}

/** Call only from the explicit confirmation. The exact preview token is submitted at most once. */
export function runWorkerWipReactivation(session: Session, review: WorkerWipReactivationReview,
  current: () => boolean): Promise<WorkerWipReactivationOutcome> {
  const proof = reviews.get(review);
  const cancelled = (): WorkerWipReactivationOutcome => ({ attempted: false, succeeded: false, reason: '' });
  if (!proof || !proof.current() || !current() || !review.target || review.target.readScope !== sessionReadScope(session) ||
      JSON.stringify({ target: review.target, map: proof.map }) !== proof.signature) return Promise.resolve(cancelled());
  if (proof.pending) return proof.pending;
  const target = review.target;
  proof.pending = (async () => {
    if (!proof.current() || !current()) return cancelled();
    try {
      await adminReactivateCompletedWork(session, target);
      return { attempted: true, succeeded: true, reason: '' };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      return { attempted: true, succeeded: false, reason: code.replace(/^reactivation_/, '') };
    }
  })();
  return proof.pending;
}
