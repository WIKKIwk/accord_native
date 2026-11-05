import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, postWorkerApiRequest, productionMapResponseError, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const string = (value: unknown) => value == null ? '' : String(value);
function apparatusId(value: string): string {
  if (!isCanonicalApparatusId(value)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return value.trim();
}

/** @v2 AdminMaterialDeliverer */
export type AdminMaterialDeliverer = { role: string; ref: string; name: string };
/** @v2 AdminMaterialDeliveryCandidates */
export type AdminMaterialDeliveryCandidates = { already_at_apparatus: boolean; deliverers: AdminMaterialDeliverer[] };

/** @v2 adminMaterialStartDeliveryCandidates */
export async function adminMaterialStartDeliveryCandidates(session: Session, orderId: string, apparatus: string,
  barcode: string): Promise<AdminMaterialDeliveryCandidates> {
  await Promise.resolve();
  const params = new URLSearchParams({ order_id: orderId.trim(), apparatus: apparatusId(apparatus), barcode: barcode.trim() });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await authorizedFetch(session, `/v1/mobile/admin/raw-material-start-receipt?${params}`, { signal: controller.signal });
    if (response.status !== 200) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = null; }
      throw productionMapResponseError(response.status, payload, 'material_delivery_candidates');
    }
    const value = object(await response.json());
    if (!value || (value.deliverers != null && !Array.isArray(value.deliverers))) throw new TypeError('Invalid delivery candidates');
    const deliverers = (value.deliverers ?? []) as unknown[];
    return { already_at_apparatus: value.already_at_apparatus === true, deliverers: deliverers.map(item => {
      const row = object(item);
      if (!row) throw new TypeError('Invalid deliverer');
      return { role: string(row.role), ref: string(row.ref), name: string(row.name) };
    }) };
  } finally { clearTimeout(timer); }
}

/** @v2 adminReceiveMaterialForStart */
export async function adminReceiveMaterialForStart(session: Session, input: { order_id: string; apparatus: string;
  barcode: string; delivered_by: AdminMaterialDeliverer; idempotency_key: string }): Promise<void> {
  const station = apparatusId(input.apparatus);
  const value = object(await postWorkerApiRequest(session, '/v1/mobile/admin/raw-material-start-receipt', {
    order_id: input.order_id.trim(), apparatus: station, barcode: input.barcode.trim(),
    delivered_by_role: input.delivered_by.role, delivered_by_ref: input.delivered_by.ref, idempotency_key: input.idempotency_key,
  }, null, false, 'material_delivery_receipt', undefined, 'text/plain; charset=utf-8'));
  if (!value) throw new TypeError('Invalid material delivery response');
  if (value.ok !== true || value.apparatus !== station || string(value.barcode).toUpperCase() !== input.barcode.trim().toUpperCase()) {
    throw new WorkerControlException('material_delivery_receipt_unconfirmed', 'Material delivery was not confirmed');
  }
}

export function materialDeliveryIdempotencyKey(orderId: string, apparatus: string, barcode: string, nowMillis = Date.now()): string {
  return `material-delivery:${orderId}:${apparatus}:${barcode}:${nowMillis * 1000}`;
}
