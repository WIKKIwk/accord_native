import type { Session } from './auth';
import { progressBatchStatusDetail } from './workerProgressModel';
import { adminWipBatches } from './workerWipApi';
import { isCanonicalApparatusId, WorkerControlException } from './workerControlsApi';

export type WipBatch = Record<string, any>;
export type WipOrder = { id: string; code: string; title: string; imageId: string; apparatusId: string };
export type WipApparatusNames = Readonly<Record<string, string>>;
export const wipText = (item: unknown) => typeof item === 'string' ? item.trim() : '';
const date = (item: unknown) => typeof item === 'number' && item > 0 ? new Date(item * 1000).toLocaleString() : '';
export const wipAmount = (item: unknown) => typeof item === 'number' && Number.isFinite(item) && item >= 0 ? item : null;
const flowLabels: Record<string, string> = {
  free_wip: 'Erkin WIP', accepted_to_stock: 'Omborga qabul qilingan', waiting_next_stage: 'Keyingi bosqich kutilmoqda',
  consumed_by_next_stage: 'Keyingi bosqichda ishlatilgan', in_progress: 'Ish jarayonida',
};

export function wipBatchKind(batch: WipBatch) {
  const flow = wipText(progressBatchStatusDetail(batch).flow_status);
  if (flow === 'in_progress' || batch.wip_status === 'in_use') return 'inUse';
  if (['consumed_by_next_stage', 'accepted_to_stock'].includes(flow) || batch.wip_status === 'processed') return 'processed';
  return 'waiting';
}

export function wipBatchStatus(batch: WipBatch) {
  return flowLabels[wipText(progressBatchStatusDetail(batch).flow_status)] ??
    ({ inUse: 'Ish jarayonida', processed: 'Ishlatilgan', waiting: 'Kutilmoqda' })[wipBatchKind(batch)];
}

export function wipBatchWeights(batch: WipBatch) {
  const measured = wipAmount(batch.payload_json?.gross_qty ?? batch.finished_goods_kg);
  const gross = measured !== null && measured > 0 ? measured : null;
  const bobina = wipAmount(batch.bobina_kg);
  const net = gross === null ? null : batch.payload_json?.include_bobina_in_net === true ? gross :
    bobina !== null && bobina <= gross ? gross - bobina : null;
  return { gross, bobina, net };
}

export function wipBatchRows(batch: WipBatch, names: WipApparatusNames) {
  const apparatus = (value: unknown) => names[wipText(value)] || wipText(value);
  return [
    ['Miqdor', wipAmount(batch.produced_qty) !== null ? `${batch.produced_qty} ${wipText(batch.uom)}`.trim() : '—'],
    ['Boshlangan', date(batch.started_at_unix)],
    ['Tugatilgan', date(batch.completed_at_unix)],
    ['Ishlab chiqargan apparat', apparatus(batch.apparatus)],
    ['Joylashuv', apparatus(batch.current_location) || apparatus(batch.current_apparatus) || apparatus(batch.apparatus)],
    ['Keyingi apparat', apparatus(batch.next_apparatus)],
    ['Ishchi', wipText(batch.worker_display_name) || wipText(batch.executor_name) || wipText(batch.worker_ref)],
  ].filter(([, value]) => value);
}

export async function loadWorkerWipBatches(session: Session, orderId: string, apparatusId: string, signal: AbortSignal) {
  const order = orderId.trim(), apparatus = apparatusId.trim();
  if (!isCanonicalApparatusId(apparatus)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const batches = new Map<string, WipBatch>();
  const loaded = await adminWipBatches(session, { status: 'all', orderId: order, producerApparatus: apparatus, limit: 500, signal });
  if (signal.aborted) return [];
  for (const batch of loaded) {
    const id = wipText(batch.batch_id);
    if (id && wipText(batch.order_id) === order && wipText(batch.apparatus) === apparatus) batches.set(id, batch);
  }
  return [...batches.values()];
}

export function wipMeters(batch: WipBatch) {
  const meters = batch.finished_goods_meter ??
    (['m', 'meter', 'metr'].includes(wipText(batch.uom).toLowerCase()) ? batch.produced_qty : null);
  const value = wipAmount(meters);
  return value !== null && value < 1e12 ? value : null;
}
