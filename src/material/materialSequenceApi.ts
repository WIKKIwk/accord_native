import type { Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { authorizedFetch } from '../authorizedFetch';
import { decodeCanonicalProductionMapSnapshot } from '../productionMapSnapshot';
import { productionMapResponseError } from '../workerControlsApi';
import { productionMapSavedFromJson } from '../workerProductionMapSaved';
import type { MaterialSequenceSnapshot } from './materialSequenceModel';

const wires = new WeakMap<MaterialSequenceSnapshot, Record<string, unknown>>();
export function materialSequenceWire(snapshot: MaterialSequenceSnapshot | null) { return snapshot ? wires.get(snapshot) ?? null : null; }
export function decodeMaterialSequenceSnapshot(wire: Record<string, unknown>, session: Session, live = false) {
  const snapshot = decodeCanonicalProductionMapSnapshot(wire, live, session);
  wires.set(snapshot, wire); return snapshot;
}

/** @v2 _readOrdersApparatus */
export function readMaterialSequenceApparatus(session: Session, current: () => boolean) {
  return adminApparatus(session, { limit: 200, beforeSend: () => {
    if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching');
  } });
}

/** @v2 _refreshCanonicalInitialOnce: atomic global snapshot/catalog; legacy map fallback only without an epoch. */
export async function readMaterialSequence(session: Session, current: () => boolean) {
  const guard = () => { if (!current()) throw new Error('Akkaunt o‘zgargan. Sahifani qayta oching'); };
  guard();
  const [snapshot, apparatus] = await Promise.all([
    (async () => {
      const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/sequence', {}, guard);
      guard(); const body: unknown = await response.json(); guard();
      if (response.status !== 200) throw productionMapResponseError(response.status, body, 'production_map_sequence');
      const decoded = decodeMaterialSequenceSnapshot(body as Record<string, unknown>, session);
      if (!decoded.maps.length && !decoded.epoch) {
        const mapsResponse = await authorizedFetch(session, '/v1/mobile/admin/production-maps', {}, guard);
        guard(); const maps: unknown = await mapsResponse.json(); guard();
        if (mapsResponse.status !== 200) throw productionMapResponseError(mapsResponse.status, maps, 'production_maps_list');
        if (!Array.isArray(maps)) throw new TypeError('Invalid production map list');
        decoded.maps = maps.map(productionMapSavedFromJson);
      }
      return decoded;
    })(),
    readMaterialSequenceApparatus(session, current),
  ]);
  guard(); return { snapshot, apparatus };
}
