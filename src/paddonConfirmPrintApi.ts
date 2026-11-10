import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { paddonFromJson, paddonIsLocked } from './paddonModels';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
/** @v2 confirmPaddonPrint */
export async function confirmPaddonPrint(session: Session, code: string, current?: () => boolean) {
  const normalized = code.trim();
  const payload = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/paddons/qr/confirm',
    { code: normalized }, null, !!current, 'paddon_print_confirm', current));
  if (!payload) throw new TypeError('Invalid paddon print confirmation');
  const paddon = paddonFromJson(payload.paddon);
  if (payload.ok !== true || paddon.code !== normalized || !paddonIsLocked(paddon))
    throw new WorkerControlException('paddon_print_confirm', 'Paddon qulfi tasdiqlanmadi');
  if (payload.apparatus != null && typeof payload.apparatus !== 'string') throw new TypeError('Invalid apparatus');
  const options: Record<string, string> = {};
  for (const raw of Array.isArray(payload.apparatus_options) ? payload.apparatus_options : []) {
    const option = object(raw); if (typeof option?.id === 'string' && typeof option?.name === 'string') options[option.id] = option.name;
  }
  return { paddon, newly_locked: payload.newly_locked === true, apparatus: payload.apparatus ?? null, apparatus_options: options };
}
