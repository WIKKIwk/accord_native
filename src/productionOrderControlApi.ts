import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
export type ProductionOrderControlState = 'active' | 'freeze_requested' | 'frozen';
export type ProductionOrderControlAction = 'freeze' | 'cancel_freeze' | 'unfreeze' | 'delete';

/** @v2 adminProductionMapOrderControl */
export async function adminProductionMapOrderControl(session: Session, input: { order_id: string; action: ProductionOrderControlAction;
  apparatus?: string; stage_node_id?: string; stage_freeze_supported?: boolean }): Promise<ProductionOrderControlState | null> {
  const apparatus = input.apparatus?.trim() ?? '', stage = input.stage_node_id?.trim() ?? '', scoped = !!apparatus;
  if (scoped && !input.stage_freeze_supported) throw new WorkerControlException('stage_freeze_unsupported',
    'Server bosqich bo‘yicha muzlatishni qo‘llamaydi. Serverni yangilang.');
  if (scoped && (!isCanonicalApparatusId(apparatus) || !stage || input.action === 'delete')) {
    throw new WorkerControlException('stage_control_target_invalid', 'Muzlatiladigan bosqich aniqlanmadi');
  }
  if (!scoped && stage) throw new WorkerControlException('stage_control_target_invalid', 'Muzlatiladigan apparat aniqlanmadi');
  const body: Obj = { order_id: input.order_id.trim(), action: input.action, scope: scoped ? 'stage' : 'order' };
  if (scoped) { body.apparatus = apparatus; body.stage_node_id = stage; }
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/order-control', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'order_control_failed');
  }
  if (input.action === 'delete') return null;
  const payload = object(await response.json()), control = object(payload?.control);
  if (!payload) throw new TypeError('Invalid order control response');
  if (!control) throw new WorkerControlException('order_control_invalid_response', 'Buyurtma holati olinmadi');
  if (scoped && (control.stage_node_id !== stage || (object(control.freeze_request) && object(control.freeze_request)?.target_apparatus !== apparatus))) {
    throw new WorkerControlException('order_control_invalid_response', 'Bosqich holati olinmadi');
  }
  const state = control.state == null ? '' : String(control.state).trim();
  return state === 'freeze_requested' || state === 'frozen' ? state : 'active';
}
