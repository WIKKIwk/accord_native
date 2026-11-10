import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { laminationAstatkaSnapshotFromJson, layerRemainderFromJson } from './workerLaminationRemainders';

export function validateLayerRemainderContext(apparatus: string, orderId: string): void {
  if (!isCanonicalApparatusId(apparatus.trim()) || !orderId.trim()) {
    throw new WorkerControlException('layer_remainder_context_invalid', 'Buyurtma yoki aparat noto‘g‘ri');
  }
}

/** @v2 adminLayerRemainders */
export async function adminWorkerLayerRemainders(session: Session, apparatus: string, orderId: string, current: () => boolean) {
  validateLayerRemainderContext(apparatus, orderId);
  const guard = () => { if (!current()) throw new Error('Session scope changed'); };
  const query = new URLSearchParams({ apparatus, order_id: orderId });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/layer-remainders?${query}`, {}, guard);
  guard();
  if (response.status !== 200) {
    let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'layer_remainder_failed');
  }
  const payload = await response.json(); guard();
  return Array.isArray(payload?.remainders) ? payload.remainders.map(layerRemainderFromJson) : [];
}

/** @v2 adminLaminationAstatkaSnapshot */
export async function adminLaminationAstatkaSnapshot(session: Session, input: { apparatus: string; order_id: string; request_id?: string }, current?: () => boolean) {
  validateLayerRemainderContext(input.apparatus, input.order_id);
  const query = new URLSearchParams({ apparatus: input.apparatus.trim(), order_id: input.order_id.trim() });
  if (input.request_id?.trim()) query.set('request_id', input.request_id.trim());
  const guard = () => { if (current && !current()) throw new Error('Session scope changed'); };
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/laminatsiya-astatka?${query}`, {}, guard);
  guard();
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'laminatsiya_astatka_report_failed');
  }
  const result = laminationAstatkaSnapshotFromJson(await response.json()); guard(); return result;
}
