import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { openingWipBatch } from './workerOpeningWip';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;

/** @v2 adminOpeningWipCandidates */
export async function adminOpeningWipCandidates(session: Session, input: { apparatus: string; order_id: string }) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/opening-wip/lookup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apparatus: input.apparatus.trim(), order_id: input.order_id.trim(), qr_payload: '' }),
  });
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'opening_wip_lookup');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid opening WIP response');
  if (payload.batches != null && !Array.isArray(payload.batches)) throw new TypeError('Invalid opening WIP batches');
  return (payload.batches as unknown[] | null | undefined ?? []).filter(item => object(item)).map(openingWipBatch);
}
