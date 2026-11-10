import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { paddonFromJson, paddonIsLocked } from './paddonModels';

/** @v2 createActivePaddonSuccessor */
export async function createActivePaddonSuccessor(session: Session, code: string, apparatus: string, current?: () => boolean) {
  const station = apparatus.trim();
  const raw = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/paddons/active/next',
    { code: code.trim(), apparatus: station }, null, !!current, 'paddon_create', current);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid paddon response');
  const payload = raw as Record<string, any>, paddon = paddonFromJson(payload.paddon);
  if (payload.ok !== true || payload.apparatus !== station || payload.code !== paddon.code || !paddon.code || paddonIsLocked(paddon))
    throw new WorkerControlException('paddon_create', 'Yangi paddon tasdiqlanmadi');
  return paddon;
}
