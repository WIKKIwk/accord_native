import { orderDisplayPath } from '../workerApi';
import { workerNextWorkStages, workerWipConsumerIds } from '../workerOutputProgress';
import type { openingWipRecordFromJson } from '../workerOpeningWipRecordsApi';
import type { QolipSequenceOrder } from './useQolipSequenceMolds';
export type QolipStageBatch = { batch_id: string; order_id: string; apparatus: string; next_apparatus: string; wip_status: string; qr_payload: string;
  started_at_unix?: number; completed_at_unix?: number; payload_json?: Record<string, unknown> };
export type QolipOrderStageFacts = { produced: number; waitingInput: number; inUseInput: number; processedInput: number };
export type QolipOrderStageNode = QolipSequenceOrder['map']['nodes'][number];

/** Source opening-WIP adapters reduced to the immutable fields the map-facts projection consumes. */
export function qolipOpeningStageBatches(order: QolipSequenceOrder, records: readonly ReturnType<typeof openingWipRecordFromJson>[]): QolipStageBatch[] {
  const result: QolipStageBatch[] = [];
  for (const record of records) {
    const intake = record.intake, source = intake.source_apparatus.trim() || intake.entry_apparatus.trim();
    if (intake.order_id.trim() !== order.map.id.trim() || !source) continue;
    const stage = intake.source_apparatus.trim() ? intake.resume_stage_node_id : '';
    const successors = workerNextWorkStages(order.map, stage);
    for (const batch of record.batches) {
      const status = String(batch.wip_status).trim().toLowerCase(); if (status === 'void') continue;
      result.push({ batch_id: batch.batch_id, order_id: batch.order_id, apparatus: source,
        next_apparatus: String(batch.used_by_apparatus).trim() || String(batch.processed_by_apparatus).trim() || (successors.length === 1 ? successors[0].apparatus : ''),
        qr_payload: batch.qr_payload, wip_status: status, started_at_unix: batch.created_at_unix, completed_at_unix: batch.updated_at_unix,
        payload_json: { stage_node_id: stage, input_wip_source_kind: 'opening_wip' } });
    }
  }
  return result;
}

/** @v2 productionMapStageWipFacts */
export function qolipOrderStageFacts(map: QolipSequenceOrder['map'], node: QolipOrderStageNode, batches: readonly QolipStageBatch[]): QolipOrderStageFacts {
  const facts = { produced: 0, waitingInput: 0, inUseInput: 0, processedInput: 0 }, seen = new Set<string>();
  for (const batch of batches) {
    if (batch.order_id.trim() !== map.id.trim() || batch.wip_status === 'void') continue;
    const key = batch.batch_id.trim() || batch.qr_payload.trim(); if (!key || seen.has(key)) continue; seen.add(key);
    if (workerWipConsumerIds(map, batch.apparatus, String(batch.payload_json?.stage_node_id ?? '').trim(), node.id).includes(node.apparatus_id.trim())) facts.produced++;
    if (!workerWipConsumerIds(map, batch.next_apparatus, String(batch.payload_json?.next_stage_node_id ?? ''), node.id).includes(node.apparatus_id.trim())) continue;
    const status = batch.wip_status.trim().toLowerCase();
    if (status === 'waiting') facts.waitingInput++; else if (status === 'in_use') facts.inUseInput++; else if (status === 'processed') facts.processedInput++;
  }
  return facts;
}

export function qolipMergedStageBatches(progress: readonly QolipStageBatch[], opening: readonly QolipStageBatch[]): QolipStageBatch[] {
  const byId = new Map(progress.map(batch => [batch.batch_id.trim(), batch]));
  for (const batch of opening) if (!byId.has(batch.batch_id.trim())) byId.set(batch.batch_id.trim(), batch);
  return [...byId.values()].sort((a, b) => Math.max(b.completed_at_unix ?? 0, b.started_at_unix ?? 0) - Math.max(a.completed_at_unix ?? 0, a.started_at_unix ?? 0)
    || (b.batch_id < a.batch_id ? -1 : b.batch_id > a.batch_id ? 1 : 0));
}
/** Supply detail has no station queue/control snapshot; its status comes only from WIP facts. */
export const qolipStageInformationStatus = (facts: QolipOrderStageFacts) => facts.produced > 0 ? 'wip_produced'
  : facts.inUseInput + facts.processedInput > 0 ? 'wip_received' : facts.waitingInput > 0 ? 'wip_available' : 'unknown';
export function qolipOrderDisplayStages(order: QolipSequenceOrder) { return orderDisplayPath(order.map) as QolipOrderStageNode[]; }
export function qolipStageStation(node: QolipOrderStageNode) { return node.alternative_group_id.trim() || !node.alternative_assigned_apparatus_id.trim() ? node.apparatus_id.trim() : node.alternative_assigned_apparatus_id.trim(); }
