import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { decodeCanonicalProductionMapSnapshot } from './productionMapSnapshot';
import { parseApparatusQueuePolicyMap } from './workerQueueModels';
import { closedProductionOrderFromJson } from './workerClosedOrders';
import { productionWorkflowAuditReportFromJson } from './productionMapAuditApi';
import { calculateOrderTemplateFromJson } from './workerOpenedOrderEditApi';
import { pendingOrderFromJson } from './pendingOrderApi';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const invalid = () => new WorkerControlException('order_page_invalid', 'Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');
const sequenceProjection = 'sequence_list_v1';
const ordersProjection = 'orders_list_v1';
const displayStates = new Set(['pending', 'print_preflight', 'print_preflight_passed', 'in_progress', 'waiting_next_stage', 'paused', 'frozen', 'issue', 'completed']);
const queueStates = new Set(['pending', 'print_preflight', 'in_progress', 'paused', 'frozen', 'completed']);
const labels = ['id', 'code', 'title', 'customer_name', 'image_id'];
const asList = (value: unknown): unknown[] => { if (value == null) return []; if (!Array.isArray(value)) throw new TypeError('Invalid page list'); return value; };
const validIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string' && !!v.trim());

function parseRows(raw: unknown, ids: string[], kind: 'sequence' | 'order' | 'pending'): Record<string, Obj> {
  const rows = object(raw);
  if (!rows || Object.keys(rows).length !== ids.length || Object.keys(rows).some(key => !ids.includes(key))) throw invalid();
  const result: Record<string, Obj> = {};
  for (const id of ids) {
    const row = object(rows[id]);
    if (!row || row.id !== id || labels.some(key => typeof row[key] !== 'string') || !row.id.trim()) throw invalid();
    if (kind === 'sequence') {
      if (typeof row.queue_state !== 'string' || !queueStates.has(row.queue_state) ||
          typeof row.display_state !== 'string' || !displayStates.has(row.display_state) || typeof row.can_reorder !== 'boolean' ||
          (Object.hasOwn(row, 'frozen') && typeof row.frozen !== 'boolean')) throw invalid();
      result[id] = { ...row, frozen: row.frozen ?? row.queue_state === 'frozen' };
    } else if (kind === 'order') {
      if (!displayStates.has(row.display_state) || !Array.isArray(row.watermarks)) throw invalid();
      for (const value of row.watermarks) {
        const watermark = object(value);
        if (!watermark || typeof watermark.apparatus_id !== 'string' ||
            (watermark.apparatus_id && !isCanonicalApparatusId(watermark.apparatus_id)) ||
            !['active', 'paused', 'frozen', 'issue', 'waiting'].includes(watermark.kind)) throw invalid();
      }
      result[id] = row;
    } else {
      if (typeof row.kg !== 'number' || !Number.isFinite(row.kg)) throw invalid();
      result[id] = row;
    }
  }
  return result;
}

export function productionOrderPageFromJson(value: unknown, session?: Session): Obj {
  const json = object(value);
  if (!json) throw new TypeError('Invalid order page');
  const projection = json.projection ?? '';
  const sequence = projection === sequenceProjection, orders = projection === ordersProjection, summary = sequence || orders;
  if (Object.hasOwn(json, 'projection') && !summary) throw invalid();
  if (summary && (Object.hasOwn(json, 'maps') || !validIds(json.order_ids) ||
      typeof json.scope !== 'string' || typeof json.version !== 'string' || typeof json.epoch !== 'string' ||
      !Number.isInteger(json.rev) || !Number.isInteger(json.offset) || !Number.isInteger(json.total) ||
      (json.next_cursor != null && typeof json.next_cursor !== 'string'))) throw invalid();
  if (orders && (!validIds(json.pending_ids) || ['sequence_versions', 'sequence_revisions', 'queue_policies', 'queue_states',
    'stage_order_controls', 'order_controls', 'stage_states', 'order_statuses', 'queue_action_controls', 'calculation_templates',
    'pending_orders', 'closed_orders', 'workflow_audit'].some(key => Object.hasOwn(json, key)))) throw invalid();
  const ids = asList(json.order_ids);
  if (ids.some(id => typeof id !== 'string')) throw new TypeError('Invalid order ids');
  const orderIds = ids as string[], pendingIds: string[] = orders ? json.pending_ids : [];
  const snapshot = Object.hasOwn(json, 'maps') && !summary ? decodeCanonicalProductionMapSnapshot(json, false, session) : null;
  let versions: Obj = {}, revisions: Obj = {}, policies: Obj = {};
  if (sequence) {
    if (!Array.isArray(json.queue_policies) || json.queue_policies.length !== 1 || !object(json.queue_policies[0]) ||
        !['strict_sequence', 'free_pick'].includes(json.queue_policies[0].discipline ?? json.queue_policies[0].policy)) throw invalid();
    versions = object(json.sequence_versions) ?? {};
    const keys = Object.keys(versions), station = keys[0];
    if (keys.length !== 1 || !isCanonicalApparatusId(station) || typeof versions[station] !== 'string' || !versions[station]) throw invalid();
    revisions = object(json.sequence_revisions) ?? {};
    if (Object.keys(revisions).length !== 1 || !Number.isInteger(revisions[station]) || revisions[station] < 0) throw invalid();
    policies = parseApparatusQueuePolicyMap(json.queue_policies);
    if (Object.keys(policies).length !== 1 || !policies[station] || policies[station].apparatus_id !== station) throw invalid();
  }
  const positions = json.sequence_positions === undefined ? {} : object(json.sequence_positions);
  if (!positions || Object.entries(positions).some(([key, n]) => !orderIds.includes(key) || !Number.isInteger(n) || (n as number) <= 0) ||
      (Object.keys(positions).length !== 0 && Object.keys(positions).length !== orderIds.length) ||
      new Set(Object.values(positions)).size !== Object.keys(positions).length) throw invalid();
  const pendingOrders = asList(json.pending_orders).map(pendingOrderFromJson);
  const closedOrders = asList(json.closed_orders).map(closedProductionOrderFromJson);
  const audit = object(json.workflow_audit) ? productionWorkflowAuditReportFromJson(json.workflow_audit) : null;
  const templates = snapshot?.calculation_templates ?? Object.fromEntries(Object.entries(object(json.calculation_templates) ?? {})
    .map(([key, item]) => [key, calculateOrderTemplateFromJson(item)]));
  const result: Obj = {
    wire_value: json, version: json.version ?? '', total: json.total == null ? -1 : Math.trunc(json.total),
    offset: json.offset == null ? -1 : Math.trunc(json.offset), epoch: json.epoch ?? '', scope: json.scope ?? '', projection,
    revision: json.rev == null ? null : Math.trunc(json.rev), next_cursor: json.next_cursor ?? null, snapshot,
    order_ids: orderIds, pending_ids: pendingIds, sequence_positions: positions,
    sequence_rows: sequence ? parseRows(json.rows, orderIds, 'sequence') : {},
    order_rows: orders ? parseRows(json.rows, orderIds, 'order') : {},
    pending_rows: orders ? parseRows(json.pending_rows, pendingIds, 'pending') : {},
    sequence_versions: snapshot?.sequence_versions ?? versions, sequence_revisions: snapshot?.sequence_revisions ?? revisions,
    queue_policies: snapshot?.queue_policies ?? policies, pending_orders: pendingOrders, closed_orders: closedOrders,
    calculation_templates: templates, workflow_audit: audit,
  };
  result.length = orderIds.length + pendingIds.length + pendingOrders.length + closedOrders.length + (audit?.violations.length ?? 0);
  const allIds = [...orderIds, ...pendingIds, ...pendingOrders.map(row => row.id), ...closedOrders.map(row => row.order_id)];
  if (!result.version || !result.epoch || result.revision == null || result.revision < 0 || result.offset < 0 ||
      result.total < result.offset + result.length || result.length > 20 || new Set(allIds).size !== allIds.length ||
      result.next_cursor === '' || (result.next_cursor != null && (!result.length || result.offset + result.length >= result.total)) ||
      (result.next_cursor == null && result.offset + result.length !== result.total) ||
      (summary && (!result.scope || (sequence && Object.keys(positions).length !== orderIds.length) ||
        (orders && Object.keys(positions).length !== 0) || pendingOrders.length || closedOrders.length || audit || Object.keys(templates).length)) ||
      (!summary && ((snapshot?.maps.length ?? 0) !== orderIds.length || orderIds.some(id => !snapshot?.maps.some((map: Obj) => map.map.id === id))))) throw invalid();
  return result;
}

export interface ProductionOrderPageRequest { view: string; apparatus?: string; target?: string; search?: string; cursor?: string | null; ifVersion?: string | null }

// Complete canonical snapshot and pending-order models are required before this method is tagged.
export async function adminProductionOrderPage(session: Session, request: ProductionOrderPageRequest) {
  const query = new URLSearchParams({ view: request.view, limit: '20' });
  if (request.view === 'sequence') query.set('projection', sequenceProjection);
  if (request.view === 'orders') query.set('projection', ordersProjection);
  for (const key of ['apparatus', 'target', 'search'] as const) if (request[key]) query.set(key, request[key]);
  if (request.cursor != null) query.set('cursor', request.cursor);
  if (request.ifVersion != null) query.set('if_version', request.ifVersion);
  const response = await authorizedFetch(session, `/v1/mobile/admin/production-maps/order-page?${query}`);
  if (response.status === 304 && request.ifVersion != null) return null;
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'order_page_failed');
  }
  return productionOrderPageFromJson(await response.json(), session);
}
