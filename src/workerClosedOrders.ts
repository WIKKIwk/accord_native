import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { progressBatchFromJson } from './workerProgressBatch';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;
const text = (value: unknown): string => value == null ? '' : String(value);
const integer = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected a finite number');
  return Math.trunc(value);
};
const station = (value: unknown): string => {
  const id = text(value).trim();
  if (!isCanonicalApparatusId(id)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  return id;
};

/** @v2 AdminProductionOrderTransferDetails */
export function productionOrderTransferFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid production-order transfer');
  if (row.material_barcodes != null && !Array.isArray(row.material_barcodes)) throw new TypeError('Invalid material barcodes');
  return { transfer_id: text(row.transfer_id), from_apparatus: station(row.from_apparatus),
    to_apparatus: station(row.to_apparatus), reason: text(row.reason), session_id: text(row.session_id),
    progress_batch_id: text(row.progress_batch_id),
    material_barcodes: (row.material_barcodes as unknown[] | null | undefined ?? []).map(item => item == null ? 'null' : String(item)) };
}

/** @v2 AdminProductionOrderFreezeDetails */
export function productionOrderFreezeFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid production-order freeze');
  const target = text(row.target_apparatus).trim();
  return { scope: row.scope == null ? 'order' : text(row.scope), stage_node_id: text(row.stage_node_id),
    request_id: text(row.request_id), status: text(row.status), target_session_id: text(row.target_session_id),
    target_apparatus: target ? station(target) : '', target_worker_role: text(row.target_worker_role),
    target_worker_ref: text(row.target_worker_ref), target_worker_display_name: text(row.target_worker_display_name),
    requested_at_unix: integer(row.requested_at_unix), transitioned_at_unix: integer(row.transitioned_at_unix) };
}

export function productionOrderFreezeIsGlobalWildcard(freeze: ReturnType<typeof productionOrderFreezeFromJson>): boolean {
  return freeze.scope === 'order' && !freeze.stage_node_id && !freeze.target_apparatus.trim() &&
    !freeze.target_session_id.trim() && !freeze.target_worker_ref.trim();
}

/** @v2 AdminProductionOrderLogEntry */
export function productionOrderLogFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid production-order log');
  const waste = object(row.zero_output_waste);
  const zeroOutputWaste: Record<string, number> = {};
  for (const key of ['total_waste', 'rezka_bosma_waste', 'rezka_lamination_waste', 'rezka_edge_waste']) {
    const quantity = waste?.[key];
    if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity >= 0) zeroOutputWaste[key] = quantity;
  }
  return { event_id: text(row.event_id), apparatus: station(row.apparatus), order_id: text(row.order_id),
    action: text(row.action), from_state: text(row.from_state), to_state: text(row.to_state),
    actor_role: text(row.actor_role), actor_ref: text(row.actor_ref), actor_display_name: text(row.actor_display_name),
    created_at_unix: integer(row.created_at_unix), completed_with_issue: row.completed_with_issue === true,
    issue_note: text(row.issue_note), zero_output_waste: zeroOutputWaste,
    transfer: object(row.transfer) ? productionOrderTransferFromJson(row.transfer) : null,
    freeze: object(row.freeze) ? productionOrderFreezeFromJson(row.freeze) : null };
}

/** @v2 AdminClosedProductionOrder */
export function closedProductionOrderFromJson(value: unknown) {
  const row = object(value);
  if (!row) throw new TypeError('Invalid closed production order');
  if (row.progress_batches != null && !Array.isArray(row.progress_batches)) throw new TypeError('Invalid progress batches');
  const logs = Array.isArray(row.logs) ? row.logs.map(productionOrderLogFromJson) : [];
  const earlyClose = object(row.early_close);
  if (earlyClose && typeof earlyClose.closed_at_unix === 'number') {
    logs.push({ event_id: `early-close:${row.order_id == null ? 'null' : String(row.order_id)}`, apparatus: '',
      order_id: text(row.order_id), action: 'close_early', from_state: '', to_state: 'cancelled',
      actor_role: text(row.closed_by_role), actor_ref: text(row.closed_by_ref), actor_display_name: text(row.closed_by_display_name),
      created_at_unix: integer(earlyClose.closed_at_unix), completed_with_issue: false, issue_note: text(earlyClose.comment),
      zero_output_waste: {}, transfer: null, freeze: null });
  }
  return { history_version: text(row.history_version), order_id: text(row.order_id), order_number: text(row.order_number),
    title: text(row.title), product_code: text(row.product_code), completed_at_unix: integer(row.completed_at_unix),
    closed_by_role: text(row.closed_by_role), closed_by_ref: text(row.closed_by_ref),
    closed_by_display_name: text(row.closed_by_display_name),
    progress_batches: (row.progress_batches as unknown[] | null | undefined ?? []).filter(item => object(item)).map(item => progressBatchFromJson(item)),
    logs };
}

/** @v2 adminClosedProductionMapOrders */
export async function adminClosedProductionMapOrders(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/production-maps/closed-orders');
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'closed_orders');
  }
  const payload = object(await response.json());
  if (!payload) throw new TypeError('Invalid closed orders response');
  return Array.isArray(payload.closed_orders) ? payload.closed_orders.map(closedProductionOrderFromJson) : [];
}
