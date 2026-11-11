import { activeSessionToken, type Session } from './auth';
import { sessionReadScope } from './sessionReadScope';
import { workerProductionOrderDetail } from './workerDetailApi';
import { validOrderControl, type QueueCursor } from './workerOrderLogic';

type Obj = Record<string, any>;
type Pending = { promise: Promise<Obj>; controller: AbortController };
const pending = new Map<string, Pending>();

/** @v2 _retryableMaterialSectionReadError */
export function workerDetailSectionRetryable(error: unknown): boolean {
  const value = error as { code?: string; statusCode?: number } | null;
  if (value?.code === 'apparatus_id_invalid') return false;
  const status = value?.statusCode;
  return status == null || status === 408 || status === 429 || status >= 500;
}

/** @v2 _WorkerCompactOrders._readWorkerListDetail */
export async function readWorkerDetailSnapshot(session: Session, apparatus: string, orderId: string,
  cursor: () => QueueCursor | null, current: () => boolean): Promise<Obj> {
  const scope = sessionReadScope(session), key = JSON.stringify([scope, apparatus, orderId]);
  let timer: ReturnType<typeof setTimeout> | undefined, lease: Pending | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (lease && pending.get(key) === lease) pending.delete(key);
      lease?.controller.abort();
      reject(new Error('Scoped order detail timed out'));
    }, 5000);
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!current() || !activeSessionToken(session) || scope !== sessionReadScope(session)) throw new Error('Sessiya o‘zgardi. Qayta urining.');
      lease = pending.get(key);
      if (!lease) {
        const controller = new AbortController();
        const entry: Pending = { controller, promise: Promise.resolve().then(() => workerProductionOrderDetail(session, apparatus, orderId, controller.signal)) };
        pending.set(key, entry);
        void entry.promise.finally(() => { if (pending.get(key) === entry) pending.delete(key); }).catch(() => {});
        lease = entry;
      }
      const snapshot = await Promise.race([lease.promise, deadline]);
      if (!current() || !activeSessionToken(session) || scope !== sessionReadScope(session)) throw new Error('Sessiya o‘zgardi. Qayta urining.');
      const baseline = cursor();
      if ((!baseline?.epoch || snapshot.epoch === baseline.epoch) &&
          (typeof baseline?.rev !== 'number' || snapshot.rev >= baseline.rev)) return snapshot;
      if (pending.get(key) === lease) pending.delete(key);
    }
    throw new Error('Buyurtma holati yangilandi. Qayta urining.');
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Use the independently validated full detail's controls while its sections load. */
export function workerDetailInitialBootstrap(snapshot: Obj, apparatus: string, orderId: string): Obj | null {
  const rawControl = snapshot.order_controls?.[orderId];
  const result = { ok: true, control_state: {
    apparatus, order_id: orderId, epoch: snapshot.epoch, rev: snapshot.rev, scope: snapshot.scope,
    queue_state: snapshot.queue_states?.[apparatus]?.[orderId],
    order_control: typeof rawControl === 'string' ? rawControl : rawControl?.state ?? 'active',
    stage_states: snapshot.stage_states?.[orderId] ?? {}, control: snapshot.queue_action_controls?.[apparatus]?.[orderId],
  }, sections: {} };
  return validOrderControl(result, apparatus, orderId, null) ? result : null;
}
