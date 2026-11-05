import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { validOrderControl } from './workerOrderLogic';
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
      throw productionMapResponseError(response.status, payload, 'production_map_sequence');
    }
    const snapshot = validateScopedQueueSnapshot(await response.json());
    guard();
    const queue = snapshot.queue_states, controls = snapshot.queue_action_controls, orderControls = snapshot.order_controls;
    const stageStates = object(snapshot.stage_states)?.[order] ?? {};
    const action = object(object(controls[station])?.[order]);
    const queueState = object(queue[station])?.[order];
    const controlState = { apparatus: station, order_id: order, rev: parseProductionMapSnapshotRevisionFromJson(snapshot), epoch: snapshot.epoch,
      scope: typeof snapshot.scope === 'string' && snapshot.scope ? snapshot.scope : scope,
      queue_state: queueState, stage_states: stageStates, order_control: orderControls[order]?.state?.trim() ?? 'active', control: action };
    const result = { ok: true, control_state: controlState, sections: {} };
    if (!object(stageStates) || !validOrderControl(result, station, order, null)) throw invalid();
    return result;
  } finally { clearTimeout(timer); }
}
