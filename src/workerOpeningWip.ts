import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value).trim();
const number = (value: unknown, fallback: number | null = null) => {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid opening WIP quantity');
  return value;
};
const integer = (value: unknown) => {
  const result = number(value, 0)!;
  if (!Number.isFinite(result)) throw new TypeError('Invalid opening WIP integer');
  return Math.trunc(result);
};

/** @v2 AdminOpeningWipBatch */
export function openingWipBatch(raw: unknown): Obj {
  const batch = object(raw);
  if (!batch) throw new TypeError('Invalid opening WIP batch');
  const basis = text(batch.quantity_basis).toLowerCase();
  return { batch_id: text(batch.batch_id), intake_id: text(batch.intake_id), order_id: text(batch.order_id),
    sequence_no: integer(batch.sequence_no), qr_payload: text(batch.qr_payload),
    quantity_basis: ['measured', 'estimated'].includes(basis) ? basis : 'unknown', quantity: number(batch.quantity),
    uom: text(batch.uom), finished_goods_meter: number(batch.finished_goods_meter), finished_goods_kg: number(batch.finished_goods_kg),
    bobina_kg: number(batch.bobina_kg), diameter: number(batch.diameter), wip_status: text(batch.wip_status),
    used_by_session_id: text(batch.used_by_session_id), used_by_apparatus: text(batch.used_by_apparatus),
    processed_by_session_id: text(batch.processed_by_session_id), processed_by_apparatus: text(batch.processed_by_apparatus),
    label_item_code: text(batch.label_item_code), label_item_name: text(batch.label_item_name),
    created_at_unix: integer(batch.created_at_unix), updated_at_unix: integer(batch.updated_at_unix) };
}

/** @v2 adminLookupOpeningWip */
export async function adminLookupOpeningWip(session: Session, input: { apparatus: string; orderId: string; qrPayload: string;
  batchId?: string }): Promise<Obj> {
  const batchId = input.batchId?.trim() ?? '';
  const response = object(await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/opening-wip/lookup', {
    apparatus: input.apparatus.trim(), order_id: input.orderId.trim(), qr_payload: input.qrPayload.trim(),
    ...(batchId ? { batch_id: batchId } : {}),
  }, null, false, 'opening_wip_lookup'));
  if (!object(response?.batch)) throw new WorkerControlException('opening_wip_lookup', 'Opening WIP QR tasdiqlanmadi');
  return openingWipBatch(response!.batch);
}
