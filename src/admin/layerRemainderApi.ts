import type { Session } from '../auth';
import { MobileApiException } from '../shared/mobileApiException';
import { isCanonicalApparatusId } from '../workerControlsApi';
import { adminProductionRequest, checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';
import { layerRemainderSnapshotFromJson } from './layerRemainderModel';

/** Partial f119 read. Session lifecycle, exact errors, large payloads and Worker parser differences remain open. */
export async function adminLayerRemainders(session: Session, apparatus: string, orderId: string, guard?: AdminRequestGuard) {
  const check = checkedAdminGuard(guard); check?.();
  const station = dartTrim(apparatus), order = dartTrim(orderId);
  if (!isCanonicalApparatusId(station) || !order)
    throw new MobileApiException({ code: 'layer_remainder_context_invalid', message: 'Buyurtma yoki aparat noto‘g‘ri' });
  const query = `apparatus=${dartQueryComponent(station)}&order_id=${dartQueryComponent(order)}`;
  const response = await adminProductionRequest(session, `/v1/mobile/admin/production-maps/layer-remainders?${query}`,
    undefined, 'layer_remainder_failed', check);
  return layerRemainderSnapshotFromJson(response);
}
