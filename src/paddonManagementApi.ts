import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { paddonFromJson } from './paddonModels';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminPaddonCreate */
export async function adminPaddonCreate(session: Session, input: { location?: string; note?: string; apparatus?: string } = {}) {
  const body: Obj = { location: input.location?.trim() ?? '', note: input.note?.trim() ?? '' };
  if (input.apparatus?.trim()) body.apparatus = input.apparatus.trim();
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_create');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid paddon create response');
  if (!object(payload.paddon)) throw new WorkerControlException('paddon_create', 'Paddon yaratilmadi');
  return paddonFromJson(payload.paddon);
}
