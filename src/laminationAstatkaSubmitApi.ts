import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { validateLayerRemainderContext } from './workerLaminationApi';
import { laminationAstatkaResultFromJson } from './workerLaminationRemainders';

type Obj = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
/** @v2 adminSubmitLaminationAstatka */
export async function adminSubmitLaminationAstatka(session: Session, request: Obj, current?: () => boolean) {
  validateLayerRemainderContext(text(request.apparatus), text(request.order_id));
  const weights = request.layer_remainder_weights;
  if (!text(request.request_id).trim() || !text(request.session_id).trim() ||
      (!Array.isArray(request.layer_remainders) && (!weights || typeof weights !== 'object' || Array.isArray(weights)))) {
    throw new WorkerControlException('laminatsiya_astatka_metrics_required', 'Astatka hisobotini to‘liq kiriting');
  }
  const result = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/laminatsiya-astatka', request,
    null, !!current, 'laminatsiya_astatka_report_failed', current);
  return laminationAstatkaResultFromJson(result);
}
