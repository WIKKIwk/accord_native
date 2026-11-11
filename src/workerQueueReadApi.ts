import { activeSessionToken, type Session } from './auth';
import { authorizedFetch, currentQueueSnapshotReadEpoch, invalidateQueueSnapshotReads } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { decodeWorkerListSnapshot } from './workerSnapshot';
import { decodeWorkerLegacySnapshot } from './workerLegacyState';
import { workerQueueContractError, workerQueueReadError } from './workerQueueReadError';
import { DEFAULT_QUEUE_LIMIT, type QueueLimit } from './workerQueueLimit';

type Obj = Record<string, unknown>;
export type WorkerQueueSnapshotOptions = { fresh?: boolean; since?: Obj | null; waitForChanges?: boolean };
const reads = new Map<string, Promise<Obj>>();

/** @v2 adminProductionMapQueueSnapshot */
export function loadWorkerQueueSnapshot(session: Session, search = '', queueLimit: QueueLimit = DEFAULT_QUEUE_LIMIT,
  options: WorkerQueueSnapshotOptions = {}): Promise<Obj> {
  if (options.fresh) invalidateQueueSnapshotReads();
  const scope = sessionReadScope(session), token = activeSessionToken(session);
  const since = options.since;
  const revision = since?.rev ?? since?.revision;
  const cursor = !options.fresh && since && typeof since.epoch === 'string' && since.epoch &&
    typeof since.scope === 'string' && since.scope && Number.isSafeInteger(revision) && (revision as number) >= 0 ? since : null;
  const query = new URLSearchParams({ worker_scope: 'true', projection: 'worker_list_v1', queue_limit: String(queueLimit), queue_positions: 'true' });
  if (search.trim()) query.set('queue_search', search.trim());
  if (cursor) {
    query.set('if_epoch', String(cursor.epoch)); query.set('if_rev', String(revision)); query.set('if_scope', String(cursor.scope));
    if (options.waitForChanges) query.set('wait_ms', '6000');
  }
  const key = JSON.stringify([session.baseUrl, token, scope, currentQueueSnapshotReadEpoch(), query.toString(), options.waitForChanges === true]);
  const previous = reads.get(key); if (previous) return previous;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    const error = new Error('API request timed out'); error.name = 'TimeoutError'; reject(error); controller.abort();
  }, 10_000); });
  const guard = () => { if (scope !== sessionReadScope(session) || !activeSessionToken(session)) throw new Error('Session changed'); };
  const request = (async () => {
    guard();
    const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/sequence?${query}`, { signal: controller.signal });
    guard();
    if (response.status === 304 && cursor) return cursor;
    if (response.status !== 200) {
      let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
      throw workerQueueReadError(response.status, payload);
    }
    const value = await response.json(); guard();
    try { return value?.projection === 'worker_list_v1' ? decodeWorkerListSnapshot(value) : decodeWorkerLegacySnapshot(value, session); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error) throw error;
      throw workerQueueContractError('invalid queue snapshot');
    }
  })();
  const pending = Promise.race([request, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
    if (reads.get(key) === pending) reads.delete(key);
  });
  reads.set(key, pending);
  return pending;
}
