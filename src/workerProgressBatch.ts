import { isCanonicalApparatusId, WorkerControlException } from './workerControlsApi';
import { progressBatchStatusDetail } from './workerProgressModel';

type Obj = Record<string, any>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const text = (value: unknown) => value == null ? '' : String(value);
const quantity = (value: unknown, fallback: number | null = null): number | null => {
  if (value == null) return fallback;
  if (typeof value !== 'number') throw new TypeError('Invalid progress quantity');
  return value;
};
const integer = (value: unknown, fallback: number) => {
  const parsed = quantity(value, fallback)!;
  if (!Number.isFinite(parsed)) throw new TypeError('Invalid progress integer');
  return Math.trunc(parsed);
};
function station(value: unknown, allowEmpty = false): string {
  const normalized = text(value).trim();
  if ((!allowEmpty || normalized) && !isCanonicalApparatusId(normalized)) {
    throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  }
  return normalized;
}

/** @v2 AdminProgressInputRoute */
export function progressInputRoute(raw: unknown): Obj {
  const route = object(raw);
  const source = text(route?.source_stage_node_id).trim(), stage = text(route?.stage_node_id).trim();
  const fingerprint = text(route?.map_fingerprint).trim(), consumers = route?.consumer_apparatus_ids;
  if (!route || !source || !stage || !fingerprint || !Array.isArray(consumers) || !consumers.length) {
    throw new WorkerControlException('wip_route_destination_unresolved', 'Server WIP yo‘nalishini tasdiqlamadi');
  }
  return { source_stage_node_id: source, stage_node_id: stage, map_fingerprint: fingerprint,
    consumer_apparatus_ids: [...new Set(consumers.map(value => station(value)))], remapped: route.remapped === true };
}

/** @v2 AdminProgressBatch */
export function progressBatchFromJson(raw: unknown, options: { inputRoute?: Obj | null; inputRouteError?: string;
  hasInputRouteMetadata?: boolean } = {}): Obj {
  const row = object(raw);
  if (!row) throw new TypeError('Invalid progress batch');
  const current = station(row.current_apparatus, true), legacy = station(row.current_apparatus_key, true);
  if (current && legacy && current !== legacy) throw new WorkerControlException('apparatus_id_mismatch', 'Progress aparat identity mos emas');
  const processed = text(row.processed_by_apparatus).trim();
  const processor = processed.startsWith('warehouse:') && processed.slice(10).trim() ? processed : station(processed, true);
  return {
    batch_id: text(row.batch_id), revision: integer(row.revision, 1), session_id: text(row.session_id),
    apparatus: station(row.apparatus), order_id: text(row.order_id), action: text(row.action), status: text(row.status),
    produced_qty: quantity(row.produced_qty, 0), uom: text(row.uom), qr_payload: text(row.qr_payload),
    label_item_code: text(row.label_item_code), label_item_name: text(row.label_item_name), executor_name: text(row.executor_name),
    diameter: quantity(row.diameter), return_ink_kg: quantity(row.return_ink_kg),
    lamination_print_leftover_rolls: quantity(row.lamination_print_leftover_rolls),
    lamination_film_leftover_rolls: quantity(row.lamination_film_leftover_rolls),
    rezka_bosma_waste: quantity(row.rezka_bosma_waste), rezka_lamination_waste: quantity(row.rezka_lamination_waste),
    rezka_edge_waste: quantity(row.rezka_edge_waste), total_waste: quantity(row.total_waste),
    finished_goods_kg: quantity(row.finished_goods_kg), bobina_kg: quantity(row.bobina_kg) ?? quantity(row.babina_kg),
    finished_goods_meter: quantity(row.finished_goods_meter), description: text(row.description),
    worker_role: text(row.worker_role), worker_ref: text(row.worker_ref), worker_display_name: text(row.worker_display_name),
    wip_status: text(row.wip_status), status_detail: progressBatchStatusDetail(row), current_apparatus: current || legacy,
    current_location: text(row.current_location), next_apparatus: station(row.next_apparatus, true), parent_batch_id: text(row.parent_batch_id),
    used_by_session_id: text(row.used_by_session_id), used_by_apparatus: station(row.used_by_apparatus, true),
    processed_by_session_id: text(row.processed_by_session_id), processed_by_apparatus: processor,
    started_at_unix: integer(row.started_at_unix, 0), completed_at_unix: integer(row.completed_at_unix, 0),
    payload_json: object(row.payload_json) ?? {}, input_route: options.inputRoute ?? null,
    input_route_error: options.inputRouteError ?? '', has_input_route_metadata: options.hasInputRouteMetadata === true,
  };
}
