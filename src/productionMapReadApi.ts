import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { productionMapSavedFromJson } from './workerProductionMapSaved';

/** @v2 adminProductionMap */
export async function adminProductionMap(session: Session, id: string) {
  const query = new URLSearchParams({ id: id.trim() });
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps?${query}`);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_map_load_failed');
  }
  return productionMapSavedFromJson(await response.json());
}

/** @v2 adminProductionMaps */
export async function adminProductionMaps(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps');
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'production_maps_list');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new TypeError('Invalid production map list');
  return payload.map(productionMapSavedFromJson);
}
