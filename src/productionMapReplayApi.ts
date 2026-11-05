import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { productionMapLiveDeltaFromJson } from './productionMapDelta';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminProductionMapReplay */
export async function adminProductionMapReplay(session: Session, input: { apparatus: string; from_rev: number; to_rev: number }) {
  const query = new URLSearchParams({ apparatus: input.apparatus, from_rev: String(input.from_rev), to_rev: String(input.to_rev) });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/replay?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_map_replay');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid production map replay response');
  return Array.isArray(payload.events) ? payload.events.filter(item => object(item))
    .map(item => productionMapLiveDeltaFromJson({ ...item, epoch: payload.epoch ?? '' })) : [];
}
