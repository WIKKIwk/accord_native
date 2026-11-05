import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;

/** @v2 activeRezkaPaddon */
export async function activeRezkaPaddon(session: Session, apparatus: string): Promise<string | null> {
  const query = new URLSearchParams({ apparatus: apparatus.trim() });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/paddons/active?${query}`, { signal: controller.signal });
    if (response.status !== 200) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'active_paddon');
    }
    const payload = object(await response.json());
    if (!payload || payload.ok !== true || payload.apparatus !== apparatus.trim() ||
        !Object.prototype.hasOwnProperty.call(payload, 'code') ||
        (payload.code !== null && (typeof payload.code !== 'string' || !payload.code.trim()))) {
      throw new WorkerControlException('active_paddon_invalid_response', 'Faol paddon ma’lumoti yuklanmadi. Qayta urinib ko‘ring.');
    }
    return payload.code as string | null;
  } finally { clearTimeout(timer); }
}
