import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { productionMapSavedFromJson } from './workerProductionMapSaved';

/** @v2 adminProductionMap */
export async function adminProductionMap(session: Session, id: string, beforeSend?: () => void, readCurrent?: () => boolean) {
  const query = new URLSearchParams({ id: id.trim() });
  const path = `/v1/mobile/admin/production-maps?${query}`;
  const guard = () => { beforeSend?.(); if (readCurrent && readCurrent() !== true) throw new Error('session_scope_changed'); };
  const response = readCurrent ? await authorizedFetch(session, path, {}, guard, 10_000, { readWitness: readCurrent })
    : beforeSend ? await authorizedFetch(session, path, {}, beforeSend) : await authorizedFetch(session, path);
  if (readCurrent) guard();
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_map_load_failed');
  }
  const payload = await response.json();
  if (readCurrent) guard();
  return productionMapSavedFromJson(payload);
}

/** @v2 adminProductionMaps */
export async function adminProductionMaps(session: Session, beforeSend?:()=>void) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps',undefined,beforeSend);
  beforeSend?.();
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_maps_list');
  }
  const payload: unknown = await response.json();
  beforeSend?.();
  if (!Array.isArray(payload)) throw new TypeError('Invalid production map list');
  return payload.map(productionMapSavedFromJson);
}
