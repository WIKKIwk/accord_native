import { activeSessionToken, type Session } from './auth';
import { authorizedFetch, currentQueueSnapshotReadEpoch, invalidateQueueSnapshotReads } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';

type Obj = Record<string, any>;
type SnapshotOptions = { apparatus?: string; order_id?: string; fresh?: boolean; worker_scope?: boolean; queue_limit?: number | null;
  queue_search?: string; since?: Obj | null; wait_for_changes?: boolean };
const reads = new Map<string, Promise<Obj>>();

// The full canonical decoder and demo store are tracked before this method receives its V2 completion tag.
export function adminProductionMapQueueSnapshot(session: Session, input: SnapshotOptions = {}): Promise<Obj> {
  if (input.fresh) invalidateQueueSnapshotReads();
  const apparatus = input.apparatus?.trim() ?? '', order = input.order_id?.trim() ?? '';
  const workerScope = input.worker_scope === true || session.profile?.role === 'rezka_master';
  const since = input.since;
  const cursor = workerScope && !apparatus && !input.fresh && since?.revision != null && since.epoch && since.scope ? since : null;
  const token = activeSessionToken(session);
  const key = JSON.stringify([session.baseUrl, token, currentQueueSnapshotReadEpoch(), apparatus, order, workerScope,
    input.queue_limit ?? null, input.queue_search ?? '', cursor?.epoch ?? null, cursor?.revision ?? null, cursor?.scope ?? null,
    input.wait_for_changes === true]);
  const existing = reads.get(key); if (existing) return existing;
  const pending = (async () => {
    const query = new URLSearchParams();
    if (apparatus) { query.set('apparatus', apparatus); query.set('order_id', order); }
    if (workerScope) {
      query.set('worker_scope', 'true');
      if (!apparatus && !order) query.set('projection', 'worker_list_v1');
      if (input.queue_limit != null) { query.set('queue_limit', String(input.queue_limit)); query.set('queue_positions', 'true'); }
      if (input.queue_search?.trim()) query.set('queue_search', input.queue_search.trim());
      if (cursor) {
        query.set('if_epoch', cursor.epoch); query.set('if_rev', String(cursor.revision)); query.set('if_scope', cursor.scope);
        if (input.wait_for_changes) query.set('wait_ms', '6000');
      }
    }
    const search = query.toString();
    const path = '/v1/mobile/admin/production-maps/sequence';
    const response = await authorizedFetch(session, search ? `${path}?${search}` : path);
    if (response.status === 304 && cursor) return cursor;
    if (response.status !== 200) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'production_map_sequence');
    }
    return decodeCanonicalProductionMapSnapshot(await response.json());
  })().finally(() => { if (reads.get(key) === pending) reads.delete(key); });
  reads.set(key, pending);
  return pending;
}
