import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { productionMapSavedFromJson } from './workerProductionMapSaved';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminMoveProductionMapOrdersBatch */
export async function adminMoveProductionMapOrdersBatch(session: Session, input: { map_ids: string[]; from_apparatus: string; to_apparatus: string }) {
  const from = input.from_apparatus.trim(), to = input.to_apparatus.trim();
  if (!isCanonicalApparatusId(from) || !isCanonicalApparatusId(to)) {
    throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  }
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/move-batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_apparatus: from, to_apparatus: to, map_ids: input.map_ids }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    const error = productionMapResponseError(response.status, payload, 'production_map_move_batch', response.headers);
    const requestId = response.headers.get('x-request-id') ?? (object(payload)?.request_id == null ? undefined : String(object(payload)?.request_id));
    throw new WorkerControlException(error.code, error.message, error.statusCode, error.diagnostics, requestId);
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid move batch response');
  return Array.isArray(payload.saved) ? payload.saved.filter(item => object(item)).map(productionMapSavedFromJson) : [];
}
