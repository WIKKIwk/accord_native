import type { Session } from './auth';
import { reactivationRecloseControl } from './workerControlsApi';
import { sessionReadScope } from './sessionReadScope';

/** @v2 _unstartedWorkerRecloseControl */
export function workerOrderReclose(session: Session, data: Record<string, any> | null, apparatus: string, orderId: string, synchronized: boolean) {
  const state = data?.control_state, control = state?.control;
  if (!synchronized || orderId.startsWith('training-') || !session.capabilities.includes('apparatus.queue.manage') ||
      !session.assigned_apparatus.includes(apparatus) || state?.order_control !== 'active' ||
      ['frozen', 'freeze_requested'].includes(control?.stage_control_state) || control?.state !== 'paused') return null;
  const checkpoint = reactivationRecloseControl(control.reclose, session);
  return checkpoint && checkpoint.stage_node_id === control.stage_node_id && checkpoint.readScope === sessionReadScope(session) &&
    checkpoint.worker_role === session.profile.role && checkpoint.worker_ref === session.profile.ref ? checkpoint : null;
}
