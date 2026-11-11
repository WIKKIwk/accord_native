import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { registerLegacyWorkerControl } from './workerOrderLogic';
import { queueActionControlState } from './workerQueueAction';
import { parseProductionMapSnapshotRevisionFromJson } from './workerQueueModels';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const invalid = () => new WorkerControlException('production_map_snapshot_contract_invalid', 'Production map navbati server shartnomasiga mos emas: invalid legacy queue');
const states = new Set(['pending', 'print_preflight', 'in_progress', 'paused', 'frozen', 'completed']);

export function validateScopedQueueSnapshot(raw: unknown): Obj {
  const snapshot = object(raw);
  if (!snapshot) throw invalid();
  for (const key of ['sequences', 'visible_order_ids']) {
    const entries = object(snapshot[key]);
    if (!entries || Object.entries(entries).some(([id, values]) => !isCanonicalApparatusId(id) || !Array.isArray(values) ||
        values.some(value => typeof value !== 'string' || !value.trim()))) throw invalid();
  }
  const queue = object(snapshot.queue_states), controls = object(snapshot.queue_action_controls), orderControls = object(snapshot.order_controls);
  if (!queue || !controls || !orderControls || !Array.isArray(snapshot.queue_policies)) throw invalid();
  for (const [id, rawStates] of Object.entries(queue)) {
    const values = object(rawStates);
    if (!isCanonicalApparatusId(id) || !values || Object.entries(values).some(([key, value]) => !key.trim() ||
        typeof value !== 'string' || !states.has(value.trim().toLowerCase()))) throw invalid();
  }
  if (snapshot.queue_policies.some((rawPolicy: unknown) => {
    const value = object(rawPolicy);
    return !value || typeof value.apparatus_id !== 'string' || !isCanonicalApparatusId(value.apparatus_id) ||
      typeof value.policy !== 'string' || !['strict_sequence', 'free_pick'].includes(value.policy.trim());
  }) || Object.entries(orderControls).some(([key, rawControl]) => {
    const value = object(rawControl);
    return !key.trim() || !value || typeof value.state !== 'string' || !['active', 'freeze_requested', 'frozen'].includes(value.state.trim());
  })) throw invalid();
  return snapshot;
}

/** Read the scoped queue control when the aggregate route is unavailable. */
export async function legacyWorkerScanControl(session: Session, apparatus: string, orderId: string): Promise<Obj> {
  const station = apparatus.trim(), order = orderId.trim(), scope = sessionReadScope(session);
  if (!isCanonicalApparatusId(station)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const guard = () => { if (scope !== sessionReadScope(session)) throw new WorkerControlException('session_scope_changed', ''); };
  const query = new URLSearchParams({ apparatus: station, order_id: order });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/sequence?${query}`, { signal: controller.signal }, guard);
    guard();
    if (response.status !== 200) {
      let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'production_map_sequence', response.headers);
    }
    const snapshot = validateScopedQueueSnapshot(await response.json());
    guard();
    const revision = parseProductionMapSnapshotRevisionFromJson(snapshot), epoch = typeof snapshot.epoch === 'string' ? snapshot.epoch : '';
    const proofScope = typeof snapshot.scope === 'string' && snapshot.scope ? snapshot.scope : scope;
    const queue = Object.fromEntries(Object.entries(snapshot.queue_states).map(([id, values]) => [id.trim(),
      Object.fromEntries(Object.entries(values as Obj).map(([order, state]) => [order.trim(), String(state).trim().toLowerCase()]))]));
    const stageStates = Object.fromEntries(Object.entries(object(snapshot.stage_states) ?? {}).flatMap(([id, values]) =>
      id.trim() && object(values) ? [[id.trim(), Object.fromEntries(Object.entries(values as Obj).filter(([stage]) => !!stage.trim())
        .map(([stage, state]) => [stage.trim(), String(state).trim().toLowerCase()]))]] : []));
    // V2 decodes every action contract in a scoped sequence, not just the target.
    const controls = Object.fromEntries(Object.entries(snapshot.queue_action_controls).map(([machine, values]) => {
      const id = machine.trim(), entries = object(values);
      if (!isCanonicalApparatusId(id) || !entries) throw invalid();
      return [id, Object.fromEntries(Object.entries(entries).map(([order, rawAction]) => {
        const target = order.trim(), action = object(rawAction);
        if (!target || !action) throw invalid();
        const parsed = queueActionControlState({ apparatus: id, order_id: target, rev: revision, epoch, scope: proofScope,
          queue_state: queue[id]?.[target] ?? String(action.state ?? '').trim(), stage_states: stageStates[target] ?? {},
          order_control: 'active', control: action }, true, session, true);
        if (!parsed) throw invalid();
        return [target, parsed.control];
      }))];
    }));
    const orderControls = Object.fromEntries(Object.entries(snapshot.order_controls).map(([id, value]) => [id.trim(), (value as Obj).state.trim()]));
    const result = { ok: true, control_state: { apparatus: station, order_id: order, rev: revision, epoch, scope: proofScope,
      queue_state: queue[station]?.[order], stage_states: stageStates[order] ?? {}, order_control: orderControls[order] ?? 'active',
      control: controls[station]?.[order] }, sections: {} };
    const registered = registerLegacyWorkerControl(result, station, order, () => scope === sessionReadScope(session));
    if (!registered) throw invalid();
    return registered;
  } finally { clearTimeout(timer); }
}
