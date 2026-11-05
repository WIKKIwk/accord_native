import type { Session } from './auth';
import { isCanonicalApparatusId, postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { parseQolipRequirements } from './workerQolips';

/** @v2 adminValidateProductionMapQolipDetails */
export async function adminValidateProductionMapQolipDetails(session: Session, input: { apparatus: string; order_id: string; qolip_code: string; automatic_confirmation?: boolean }) {
  const apparatus = input.apparatus.trim(), code = input.qolip_code.trim(), automatic = input.automatic_confirmation === true;
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const payload = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/qolip-validate', {
    apparatus, order_id: input.order_id.trim(), qolip_code: code, ...(automatic && !code ? { automatic_confirmation: true } : {}),
  }, null, false, 'qolip_code_not_found');
  const result = parseQolipRequirements(payload, automatic);
  const raw = payload && typeof payload === 'object' ? (payload as { qolip?: unknown }).qolip : null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) result.qolip_code = code;
  return result;
}
