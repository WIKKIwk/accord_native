import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { paddonSnapshotFromJson } from './paddonModels';

/** @v2 adminPaddonAddWips */
export async function adminPaddonAddWips(session: Session, input: { paddon_code: string; progress_batch_ids: string[] }) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/items/add-batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: input.paddon_code.trim(),
      progress_batch_ids: input.progress_batch_ids.map(id => id.trim()).filter(Boolean) }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_items_add');
  }
  return paddonSnapshotFromJson(await response.json());
}
