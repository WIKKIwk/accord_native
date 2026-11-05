import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { progressBatchFromJson } from './workerProgressBatch';

type Obj = Record<string, any>;
function optionalStation(value: string): string {
  const id = value.trim();
  if (id && !isCanonicalApparatusId(id)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return id;
}

/** @v2 adminWipBatches */
export async function adminWipBatches(session: Session, options: {
  status?: string; apparatus?: string; nextApparatus?: string; currentLocation?: string; orderId?: string;
  producerApparatus?: string; ownWorkerOnly?: boolean; limit?: number; signal?: AbortSignal;
} = {}): Promise<Obj[]> {
  const scope = sessionReadScope(session), producer = optionalStation(options.producerApparatus ?? ''),
    apparatus = optionalStation(options.apparatus ?? ''), next = optionalStation(options.nextApparatus ?? ''),
    status = (options.status ?? '').trim(), location = (options.currentLocation ?? '').trim(), order = (options.orderId ?? '').trim();
  const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 100)));
  const guard = () => { if (scope !== sessionReadScope(session)) throw new WorkerControlException('session_scope_changed', ''); };
  const batches: Obj[] = [], cursors = new Set<string>();
  let cursor = '';
  await Promise.resolve();
  do {
    guard();
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (apparatus) query.set('apparatus', apparatus);
    if (next) query.set('next_apparatus', next);
    if (location) query.set('current_location', location);
    if (order) query.set('order_id', order);
    if (producer) query.set('producer_apparatus', producer);
    if (options.ownWorkerOnly) query.set('own_worker', 'true');
    if (cursor) query.set('before_batch_id', cursor);
    query.set('limit', String(limit));
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 10_000);
    try {
      const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/wip-batches?${query}`,
        { signal: controller.signal }, guard);
      guard();
      if (response.status !== 200) {
        let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
        throw productionMapResponseError(response.status, payload, 'wip_batches');
      }
      const payload: unknown = await response.json();
      guard();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray((payload as Obj).batches)) {
        throw new TypeError('WIP response must contain a batches list');
      }
      const data = payload as Obj;
      batches.push(...data.batches.map((row: unknown) => progressBatchFromJson(row)));
      if (producer && data.next_before_batch_id != null && typeof data.next_before_batch_id !== 'string') {
        throw new TypeError('Invalid WIP history cursor');
      }
      cursor = producer ? (data.next_before_batch_id ?? '').trim() : '';
      if (cursor && cursors.has(cursor)) throw new TypeError('WIP history cursor did not advance');
      if (cursor) cursors.add(cursor);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  } while (cursor);
  return batches;
}
