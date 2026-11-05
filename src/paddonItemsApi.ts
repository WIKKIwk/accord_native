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

/** @v2 adminPaddonRemoveWip */
export async function adminPaddonRemoveWip(session: Session, input: { paddon_code: string; progress_batch_id: string }) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/items/remove', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: input.paddon_code.trim(), progress_batch_id: input.progress_batch_id.trim() }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_item_remove');
  }
  return paddonSnapshotFromJson(await response.json());
}

/** @v2 adminPaddonRemoveWips */
export async function adminPaddonRemoveWips(session: Session, input: { paddon_code: string; progress_batch_ids: string[] }) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/paddons/items/remove-batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: input.paddon_code.trim(),
      progress_batch_ids: input.progress_batch_ids.map(id => id.trim()).filter(Boolean) }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'paddon_items_remove');
  }
  return paddonSnapshotFromJson(await response.json());
}
