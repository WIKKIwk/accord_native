import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { decodeCanonicalProductionMapSnapshot } from '../productionMapSnapshot';
import { sessionReadScope } from '../sessionReadScope';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from '../workerControlsApi';
import { jsonObject } from './preparationModel';
import { preparationStorageKey, withQuery } from './preparationRequest';

export type PreparationOrderListRow = { id: string; code: string; order_number: string; title: string; customer_name: string; image_id: string; position: number };
export type PreparationOrderListWindow = { scope: string; epoch: string; rev: number; version: string; apparatus_id: string;
  apparatus: { id: string; name: string }[]; rows: PreparationOrderListRow[]; total: number; next_cursor: string | null; search: string };
const invalid = (): never => { throw new WorkerControlException('preparation_orders_invalid', 'Buyurtmalar yuklanmadi. Qayta urinib ko‘ring.'); };
const resync = (): never => { throw new WorkerControlException('preparation_orders_resync', 'Buyurtmalar o‘zgardi. Qayta yuklang.', 409); };
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @v2 PreparationOrderListRow */
export function preparationOrderListRowFromJson(value: unknown): PreparationOrderListRow {
  if (!isObject(value)) return invalid();
  const data = value;
  if (['id', 'code', 'order_number', 'title', 'customer_name', 'image_id'].some(key => typeof data[key] !== 'string') ||
      !(data.id as string).trim() || !isInt(data.position) || data.position < 1) return invalid();
  return { id: data.id as string, code: data.code as string, order_number: data.order_number as string, title: data.title as string,
    customer_name: data.customer_name as string, image_id: data.image_id as string, position: data.position };
}
/** @v2 PreparationOrderListWindow */
export function preparationOrderListWindowFromJson(value: unknown): PreparationOrderListWindow {
  if (!isObject(value)) return invalid();
  const data = value;
  if (data.ok !== true || data.projection !== 'preparation_order_list_v1' ||
      ['scope', 'epoch', 'version', 'apparatus_id'].some(key => typeof data[key] !== 'string') ||
      !data.scope || !data.epoch || !data.version || !isInt(data.rev) || data.rev < 0 ||
      !isInt(data.total) || data.total < 0 || !Array.isArray(data.rows) || !Array.isArray(data.apparatus) ||
      (data.next_cursor != null && typeof data.next_cursor !== 'string')) return invalid();
  const apparatus = data.apparatus.map(value => {
    if (!isObject(value)) return invalid();
    const row = value;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !isCanonicalApparatusId(row.id)) return invalid();
    return { id: row.id, name: row.name };
  });
  const rows = data.rows.map(preparationOrderListRowFromJson), apparatusId = data.apparatus_id as string;
  if ((apparatusId && !apparatus.some(item => item.id === apparatusId)) || new Set(rows.map(row => row.id)).size !== rows.length || rows.length > data.total) return invalid();
  return { scope: data.scope as string, epoch: data.epoch as string, rev: data.rev, version: data.version as string,
    apparatus_id: apparatusId, apparatus, rows, total: data.total, next_cursor: data.next_cursor as string | null ?? null,
    search: typeof data.search === 'string' ? data.search.trim().toLowerCase() : '' };
}
/** @v2 applyLiveCheckpoint */
export function preparationOrdersCheckpoint(window: PreparationOrderListWindow, event: Record<string, unknown>): PreparationOrderListWindow {
  if (event.epoch !== window.epoch || event.scope !== window.scope || event.version !== window.version ||
      (event.apparatus_id != null && event.apparatus_id !== window.apparatus_id) || !isInt(event.rev) || event.rev < window.rev) return resync();
  return { ...window, rev: event.rev };
}
/** @v2 applyLiveDelta */
export function preparationOrdersDelta(window: PreparationOrderListWindow, event: Record<string, unknown>): PreparationOrderListWindow {
  if (event.base_version !== window.version || event.scope !== window.scope || event.epoch !== window.epoch ||
      event.apparatus_id !== window.apparatus_id || !isInt(event.rev) || event.rev < window.rev ||
      !Array.isArray(event.order_ids) || !Array.isArray(event.upserts) || !Array.isArray(event.removed_ids)) return resync();
  function ids(value: unknown[]): string[] {
    if (value.some(id => typeof id !== 'string' || !id) || new Set(value).size !== value.length) return resync();
    return value as string[];
  }
  const orderIds = ids(event.order_ids), removed = ids(event.removed_ids), orderSet = new Set(orderIds), removedSet = new Set(removed);
  const byId = new Map(window.rows.map(row => [row.id, row]));
  if (removed.some(id => !byId.has(id) || orderSet.has(id)) || [...byId.keys()].some(id => !orderSet.has(id) && !removedSet.has(id))) return resync();
  removed.forEach(id => byId.delete(id));
  const upserts = new Set<string>();
  for (const value of event.upserts) {
    if (!isObject(value)) return resync();
    const row = preparationOrderListRowFromJson(value);
    if (upserts.has(row.id) || !orderSet.has(row.id)) return resync();
    upserts.add(row.id); byId.set(row.id, row);
  }
  if (orderIds.some(id => !byId.has(id))) return resync();
  const metadata = preparationOrderListWindowFromJson({ ...event, ok: true, search: window.search, rows: [] });
  if (orderIds.length > metadata.total) return resync();
  return { ...metadata, rows: orderIds.map(id => byId.get(id)!) };
}
async function errorResponse(response: Response, fallback: string): Promise<never> {
  let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
  throw productionMapResponseError(response.status, payload, fallback);
}
function orderGuard(session: Session) {
  const scope = sessionReadScope(session), owner = preparationStorageKey(session);
  return () => { if (preparationStorageKey(session) !== owner || sessionReadScope(session) !== scope) invalid(); };
}
/** @v2 preparationOrders */
export async function preparationOrders(session: Session, options: { apparatus?: string; search?: string; cursor?: string | null;
  baseline?: PreparationOrderListWindow | null; refresh?: boolean } = {}): Promise<PreparationOrderListWindow> {
  const apparatus = options.apparatus ?? '', search = (options.search ?? '').trim().toLowerCase(), cursor = options.cursor ?? null;
  const conditional = cursor === null && options.baseline && options.baseline.search === search && (!apparatus || apparatus === options.baseline.apparatus_id)
    ? options.baseline : null;
  const query = { limit: '30', ...(apparatus ? { apparatus } : {}), ...(search ? { search } : {}), ...(cursor !== null ? { cursor } : {}),
    ...(conditional && conditional.rows.length > 30 ? { length: String(Math.min(10000, Math.max(30, conditional.rows.length))) } : {}),
    ...(conditional && !options.refresh ? { if_version: conditional.version } : {}), ...(options.refresh ? { refresh: 'true' } : {}) };
  const guard = orderGuard(session), response = await authorizedFetch(session, withQuery('/v1/mobile/preparation/orders', query), {}, guard);
  guard();
  if (response.status === 304) {
    if (!conditional || options.refresh) return invalid();
    const epoch = response.headers.get('x-production-epoch'), serverScope = response.headers.get('x-preparation-scope');
    const version = response.headers.get('x-preparation-version'), rawRevision = response.headers.get('x-production-revision');
    const revision = rawRevision != null && /^\s*[+-]?\d+\s*$/.test(rawRevision) ? Number(rawRevision) : null;
    if ((epoch !== null && epoch !== conditional.epoch) || (serverScope !== null && serverScope !== conditional.scope) ||
        (version !== null && version !== conditional.version) || (revision !== null && revision < conditional.rev)) return resync();
    return { ...conditional, rev: revision ?? conditional.rev };
  }
  if (response.status !== 200) return errorResponse(response, 'preparation_orders_failed');
  return { ...preparationOrderListWindowFromJson(await response.json()), search };
}
/** @v2 preparationOrderDetail */
export async function preparationOrderDetail(session: Session, orderId: string) {
  const guard = orderGuard(session);
  const response = await authorizedFetch(session, `/v1/mobile/preparation/orders/${encodeURIComponent(orderId)}`, {}, guard);
  if (response.status !== 200) return errorResponse(response, 'preparation_order_detail_failed');
  const snapshot = decodeCanonicalProductionMapSnapshot(await response.json(), false, session);
  guard();
  if (!Array.isArray(snapshot.maps) || snapshot.maps.length !== 1 || jsonObject(jsonObject(snapshot.maps[0]).map).id !== orderId ||
      typeof snapshot.epoch !== 'string' || !snapshot.epoch || snapshot.revision == null || typeof snapshot.scope !== 'string' || !snapshot.scope) return invalid();
  return snapshot;
}
