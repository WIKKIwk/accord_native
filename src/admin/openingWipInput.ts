import { dartTrim } from './dartJsonString';

export type AdminOpeningWipQuantityBasis = 'measured' | 'estimated' | 'unknown';
export type AdminOpeningWipBatchInput = { quantity_basis: AdminOpeningWipQuantityBasis; finished_goods_meter: number;
  finished_goods_kg: number; bobina_kg: number; diameter?: number | null };
export type AdminOpeningWipCreateInput = { idempotency_key: string; order_id: string; source_apparatus: string;
  source_stage_node_id: string; batches: readonly AdminOpeningWipBatchInput[]; note?: string };
function finite(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('Invalid opening WIP number');
  return value;
}
/** Partial f119 source-derived serialization; JSON double-token distinctions remain open. */
export function openingWipBatchInputToJson(input: AdminOpeningWipBatchInput) {
  return { quantity_basis: input.quantity_basis, finished_goods_meter: finite(input.finished_goods_meter),
    finished_goods_kg: finite(input.finished_goods_kg), bobina_kg: finite(input.bobina_kg),
    ...(input.diameter == null ? {} : { diameter: finite(input.diameter) }) };
}
export function openingWipCreateInputToJson(input: AdminOpeningWipCreateInput) {
  const note = dartTrim(input.note ?? '');
  return { idempotency_key: dartTrim(input.idempotency_key), order_id: dartTrim(input.order_id),
    source_apparatus: dartTrim(input.source_apparatus), source_stage_node_id: dartTrim(input.source_stage_node_id),
    ...(note ? { note } : {}), batches: input.batches.map(openingWipBatchInputToJson) };
}
