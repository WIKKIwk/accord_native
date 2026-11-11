import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const invalid = () => new WorkerControlException('production_map_snapshot_contract_invalid',
  'Production map navbati server shartnomasiga mos emas: invalid scoped worker detail');

/** @v2 workerProductionOrderDetail */
export async function workerProductionOrderDetail(session: Session, apparatus: string, orderId: string, signal?: AbortSignal): Promise<Obj> {
  const station = apparatus.trim(), order = orderId.trim();
  if (!isCanonicalApparatusId(station)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  if (!order) throw new WorkerControlException('order_page_invalid', 'Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');
  const query = new URLSearchParams({ worker_scope: 'true', detail: 'true', apparatus: station, order_id: order });
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10_000);
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/sequence?${query}`, { signal: controller.signal });
    if (response.status !== 200) {
      let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'worker_order_detail', response.headers);
    }
    const wire = object(await response.json());
    const snapshot = decodeCanonicalProductionMapSnapshot(wire, false, session);
    const maps = snapshot.maps, revision = snapshot.revision;
    if ((snapshot.projection != null && snapshot.projection !== '' && snapshot.projection !== 'worker_detail_v1') ||
        !Array.isArray(maps) || maps.length !== 1 || maps[0].map.id !== order || typeof snapshot.epoch !== 'string' || !snapshot.epoch ||
        typeof snapshot.scope !== 'string' || !snapshot.scope || revision === null || revision < 0) throw invalid();
    return { ...snapshot, rev: revision };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
