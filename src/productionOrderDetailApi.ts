import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';
import { adminProductionReadIdentityCompression } from './productionReadSettings';

const invalid = () => new WorkerControlException('order_page_invalid', 'Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');

/** @v2 adminProductionOrderDetail */
export async function adminProductionOrderDetail(session: Session, input: { apparatus: string; order_id: string }) {
  const apparatus = input.apparatus.trim(), id = input.order_id.trim();
  if (apparatus && !isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  if (!id) throw invalid();
  const query = new URLSearchParams();
  if (apparatus) query.set('apparatus', apparatus);
  query.set('order_id', id); query.set('detail', 'true');
  if (adminProductionReadIdentityCompression) query.set('compression', 'identity');
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/sequence?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'order_detail_failed');
  }
  const snapshot = decodeCanonicalProductionMapSnapshot(await response.json(), false, session);
  if (!Array.isArray(snapshot.maps) || snapshot.maps.length !== 1 || snapshot.maps[0].map.id !== id || snapshot.revision == null || snapshot.revision < 0 ||
      !snapshot.epoch || !snapshot.scope || Object.keys(snapshot.calculation_templates).some(key => key !== id)) throw invalid();
  return snapshot;
}
