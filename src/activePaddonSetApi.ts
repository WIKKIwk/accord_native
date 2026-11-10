import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
/** @v2 setActiveRezkaPaddon */
export async function setActiveRezkaPaddon(session: Session, apparatus: string, code: string | null, current?: () => boolean): Promise<string | null> {
  const station = apparatus.trim();
  const guard = () => { if (current && current() !== true) throw new Error('worker.error.sync'); };
  guard();
  const init = { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apparatus: station, code: code?.trim() ?? '' }) };
  const path = '/v1/mobile/admin/production-maps/paddons/active';
  const response = current ? await authorizedFetch(session, path, init, guard) : await authorizedFetch(session, path, init);
  guard();
  if (response.status !== 200) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw productionMapResponseError(response.status, data, 'active_paddon');
  }
  const raw: unknown = await response.json(); guard();
  const payload = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  if (!payload || payload.ok !== true || payload.apparatus !== station || !Object.hasOwn(payload, 'code') ||
      (payload.code !== null && (typeof payload.code !== 'string' || !payload.code.trim())))
    throw new WorkerControlException('active_paddon_invalid_response', 'Faol paddon ma’lumoti yuklanmadi. Qayta urinib ko‘ring.');
  return payload.code as string | null;
}
