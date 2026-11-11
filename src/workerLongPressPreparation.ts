import type { Session } from './auth';
import type { QueueOrder } from './workerApi';
import { MobileApiException } from './shared/mobileApiException';
import { WorkerControlException } from './workerControlsApi';
import { workerProductionOrderDetail } from './workerDetailApi';
import { workerLongPressMenu, type WorkerMenu } from './workerLongPress';
import type { QueueCursor } from './workerOrderLogic';
import { adminWipBatches } from './workerWipApi';
import { workerHandoffBatch } from './workerHandoff';
import { prepareWorkerWipReactivation, type WorkerWipReactivationReview } from './workerWipReactivation';

type Obj = Record<string, any>;
type Text = (key: string, values?: Record<string, unknown>) => string;
export type WorkerPreparedActionSheet = { kind: 'menu'; menu: WorkerMenu }
  | { kind: 'reactivation'; reactivation: WorkerWipReactivationReview };
export type WorkerPreparedLongPress = WorkerPreparedActionSheet | { kind: 'none' } | { kind: 'astatka' };

/** @v2 _WorkerCompactOrders._readWorkerListDetail */
async function readLongPressDetail(session: Session, apparatus: string, order: string,
  getCursor: () => QueueCursor | null, current: () => boolean, signal: AbortSignal): Promise<Obj | null> {
  const controller = new AbortController();
  let cancel: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error('Scoped order detail cancelled')); };
  });
  const deadline = new Promise<never>((_, reject) => {
    const timeout = setTimeout(() => {
      controller.abort(); reject(new Error('Scoped order detail timed out'));
    }, 5000);
    controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
  });
  signal.addEventListener('abort', cancel, { once: true });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted || !current()) return null;
      const detail = await Promise.race([workerProductionOrderDetail(session, apparatus, order, controller.signal), deadline, cancelled]);
      if (signal.aborted || !current()) return null;
      const baseline = getCursor();
      if (baseline?.epoch && (detail.epoch !== baseline.epoch ||
          typeof baseline.rev === 'number' && detail.rev < baseline.rev)) continue;
      return detail;
    }
    throw new MobileApiException({ code: 'order_page_changed', message: 'Buyurtma yangilandi. Qayta oching.' });
  } finally {
    signal.removeEventListener('abort', cancel);
    controller.abort();
  }
}

/** @v2 _AdminProductionMapOrdersScreenState._showWatchOrderLongPress */
export async function prepareWorkerLongPress(session: Session, apparatus: { id: string; name: string; operation: string },
  order: QueueOrder, completed: boolean, getCursor: () => QueueCursor | null, current: () => boolean,
  signal: AbortSignal, p: Text, notice: (message: string) => void): Promise<WorkerPreparedLongPress> {
  const none = { kind: 'none' } as const;
  const detail = await readLongPressDetail(session, apparatus.id, order.id, getCursor, current, signal);
  if (!detail || signal.aborted || !current()) return none;
  if (completed) {
    const reactivation = await prepareWorkerWipReactivation(session, { apparatus, map: detail.maps[0].map,
      workerMode: true, allowReactivation: true }, p, current);
    return reactivation && !signal.aborted && current() ? { kind: 'reactivation', reactivation } : none;
  }
  const control = detail.queue_action_controls[apparatus.id]?.[order.id];
  const data = { ok: true, control_state: { apparatus: apparatus.id, order_id: order.id,
    epoch: detail.epoch, scope: detail.scope, rev: detail.rev, order_control: detail.order_controls[order.id] ?? 'active',
    queue_state: detail.queue_states[apparatus.id]?.[order.id] ?? control?.state ?? '',
    stage_states: detail.stage_states[order.id] ?? {}, control } };
  let menu = workerLongPressMenu(data, session, apparatus.id, order.id, getCursor(), apparatus.operation);
  if (menu.kind === 'none') return none;
  if (menu.kind === 'astatka') return { kind: 'astatka' };
  if (['laminate', 'glue'].includes(apparatus.operation) && menu.control.state === 'paused' && !menu.actions.includes('reclose')) {
    try {
      const batches = await adminWipBatches(session, { status: 'all', apparatus: apparatus.id, orderId: order.id, limit: 250 });
      if (signal.aborted || !current()) return none;
      if (workerHandoffBatch(batches, apparatus.id, order.id)) menu = { ...menu, kind: 'handoff',
        actions: ['resume', 'detach_roll', ...(apparatus.operation === 'laminate' ? ['astatka' as const] : [])] };
    } catch (error) {
      if (signal.aborted || !current()) return none;
      notice(error instanceof MobileApiException || error instanceof WorkerControlException ? error.message : p('worker.error.machine_roll'));
    }
  }
  if (signal.aborted || !current()) return none;
  return { kind: 'menu', menu };
}
