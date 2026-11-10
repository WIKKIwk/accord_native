type Batch = Record<string, any>;
/** @v2 _AdminProductionMapOrdersScreenState._laminatsiyaWorkerHandoffBatch */
export function workerHandoffBatch(batches: readonly Batch[], apparatus: string, orderId: string): Batch | null {
  return batches.find(batch => String(batch.batch_id ?? '').trim() && String(batch.order_id ?? '').trim() === orderId &&
    String(batch.wip_status ?? '').trim().toLowerCase() === 'in_use' &&
    (String(batch.used_by_apparatus ?? '').trim() || String(batch.current_apparatus ?? '').trim()) === apparatus &&
    batch.payload_json?.worker_handoff === true) ?? null;
}
