import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { laminationAstatkaSnapshotFromJson } from './workerLaminationRemainders';

export function validateLayerRemainderContext(apparatus: string, orderId: string): void {
  if (!isCanonicalApparatusId(apparatus.trim()) || !orderId.trim()) {
    throw new WorkerControlException('layer_remainder_context_invalid', 'Buyurtma yoki aparat noto‘g‘ri');
  }
}

/** @v2 adminLaminationAstatkaSnapshot */
export async function adminLaminationAstatkaSnapshot(session: Session, input: { apparatus: string; order_id: string; request_id?: string }) {
  validateLayerRemainderContext(input.apparatus, input.order_id);
  const query = new URLSearchParams({ apparatus: input.apparatus.trim(), order_id: input.order_id.trim() });
  if (input.request_id?.trim()) query.set('request_id', input.request_id.trim());
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/laminatsiya-astatka?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'laminatsiya_astatka_report_failed');
  }
  return laminationAstatkaSnapshotFromJson(await response.json());
}
