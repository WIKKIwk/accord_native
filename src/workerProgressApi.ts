import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { sessionReadScope } from './sessionReadScope';
import { postWorkerApiRequest, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { progressBatchFromJson, progressInputRoute } from './workerProgressBatch';
import { adminProductionMapQueueSnapshot } from './productionMapQueueSnapshotApi';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

async function requireActiveOrder(session: Session, orderId: string): Promise<void> {
  const snapshot = await adminProductionMapQueueSnapshot(session, { fresh: true });
  const rawState = object(snapshot.order_controls[orderId])?.state;
  const orderState = typeof rawState === 'string' ? rawState : 'active';
  if (orderState === 'frozen') {
    const title = snapshot.maps.find((order: Obj) => order.map.id.trim() === orderId)?.map.title ?? '';
    throw new WorkerControlException('order_frozen',
      'Buyurtma muzlatilgan. Iltimos, adminga xabar bering va buyurtmani muzdan ochishini so‘rang.', undefined, { order_title: title });
  }
  if (orderState === 'freeze_requested') throw new WorkerControlException('order_freeze_requested',
    'Buyurtmani muzlatish so‘ralgan. Yangi ish boshlash mumkin emas. Iltimos, adminga murojaat qiling.');
}

export async function adminProgressQrLookup(session: Session, qrPayload: string, options: { apparatus?: string; orderId?: string;
  requireActiveOrder?: boolean } = {}): Promise<Obj> {
  const station = (options.apparatus ?? '').trim(), order = (options.orderId ?? '').trim(), scoped = !!station || !!order;
  const invalid = (message = 'Server QR ma’lumotlarini to‘liq qaytarmadi') => new WorkerControlException('progress_qr_invalid_response', message);
  let response: unknown;
  try {
    response = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/progress-qr/lookup', {
      qr_payload: qrPayload.trim(), ...(options.requireActiveOrder ? { require_active_order: true } : {}),
      ...(scoped ? { apparatus: station, order_id: order } : {}),
    }, null, false, 'progress_qr_lookup_failed');
  } catch (error) {
    if (error instanceof SyntaxError) throw invalid();
    throw error;
  }
  const payload = object(response), batch = object(payload?.batch);
  if (!payload || !batch) throw invalid();
  if (options.requireActiveOrder && (typeof batch.batch_id !== 'string' || !batch.batch_id.trim() ||
      typeof batch.order_id !== 'string' || !batch.order_id.trim() || !['waiting', 'in_use', 'processed'].includes(batch.wip_status))) {
    throw invalid('Server QR ruloni yoki buyurtma holatini to‘liq qaytarmadi');
  }
  if (options.requireActiveOrder && payload.active_order_validated !== true) await requireActiveOrder(session, String(batch.order_id).trim());
  if (scoped && (payload.validated_apparatus !== station || payload.validated_order_id !== order)) {
    throw new WorkerControlException('progress_qr_validation_missing', 'Server QR yo‘nalishini tasdiqlamadi');
  }
  const hasMetadata = Object.hasOwn(payload, 'input_route') || Object.hasOwn(payload, 'input_route_error');
  const rawRoute = payload.input_route, routeError = String(payload.input_route_error ?? '').trim();
  if (rawRoute != null && (!object(rawRoute) || routeError)) throw new WorkerControlException('wip_route_ambiguous', 'Server WIP yo‘nalishini aniq tasdiqlamadi');
  const route = rawRoute != null ? progressInputRoute(rawRoute) : null;
  const effectiveError = !routeError && hasMetadata && !route ? 'wip_route_destination_unresolved' : routeError;
  if (scoped && effectiveError) throw new WorkerControlException(effectiveError, 'Server WIP yo‘nalishini tasdiqlamadi');
  if (scoped && route && !route.consumer_apparatus_ids.includes(station)) {
    throw new WorkerControlException('progress_batch_not_accepted', 'Server QR yo‘nalishini tasdiqlamadi');
  }
  return progressBatchFromJson(batch, { inputRoute: route, inputRouteError: effectiveError, hasInputRouteMetadata: hasMetadata });
}

/** @v2 adminProgressQrHistory */
export async function adminProgressQrHistory(session: Session, options: { limit?: number; rezkaTeamDay?: Date | null;
  signal?: AbortSignal } = {}): Promise<Obj[]> {
  const limit = Math.max(1, Math.min(200, Math.trunc(options.limit ?? 200))), scope = sessionReadScope(session);
  const day = options.rezkaTeamDay ?? null;
  if (day && session.profile?.role !== 'rezka_master') throw new WorkerControlException('forbidden', '');
  const from = day ? Math.trunc(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 1000) : null;
  const until = day ? Math.trunc(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime() / 1000) : null;
  const guard = () => { if (scope !== sessionReadScope(session)) throw new WorkerControlException('session_scope_changed', ''); };
  const batches: Obj[] = [], cursors = new Set<string>();
  let cursor: string | null = null;
  await Promise.resolve();
  do {
    guard();
    const query = new URLSearchParams({ limit: String(limit) });
    if (from !== null && until !== null) {
      query.set('rezka_team', 'true'); query.set('from_unix', String(from)); query.set('until_unix', String(until));
      if (cursor !== null) query.set('before_batch_id', cursor);
    }
    const controller = new AbortController(), abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 10_000);
    try {
      const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/progress-qr/history?${query}`,
        { signal: controller.signal }, guard);
      guard();
      if (response.status !== 200) {
        let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
        throw productionMapResponseError(response.status, payload, 'progress_qr_history');
      }
      const payload: unknown = await response.json();
      guard();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Invalid progress history');
      const value = payload as Obj, raw = value.batches;
      if (Array.isArray(raw)) batches.push(...raw.map(item => progressBatchFromJson(item)));
      if (!day) break;
      const next = value.next_before_batch_id;
      if (!Array.isArray(raw) || !Object.hasOwn(value, 'next_before_batch_id') ||
          (next != null && (typeof next !== 'string' || !next || cursors.has(next)))) {
        throw new WorkerControlException('progress_qr_history', '');
      }
      cursor = next ?? null;
      if (cursor !== null) cursors.add(cursor);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  } while (cursor !== null);
  return batches;
}
