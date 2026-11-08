import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { calculateOrderTemplateFromJson } from './workerOpenedOrderEditApi';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const invalid = () => new WorkerControlException('order_page_invalid', 'Buyurtmalar sahifasi noto‘g‘ri. Qayta yuklang.');
/** @v2 PendingOrder */
export function pendingOrderFromJson(value: unknown) {
  const row = object(value);
  if (!row || typeof row.id !== 'string' || !object(row.template) || (row.manager_name != null && typeof row.manager_name !== 'string'))
    throw new TypeError('Invalid pending order');
  return { id: row.id, template: calculateOrderTemplateFromJson(row.template), manager_name: row.manager_name ?? '', completed: row.completion != null };
}
/** @v2 pendingOrderDetail */
export async function pendingOrderDetail(session: Session, orderId: string, beforeSend?: () => void) {
  const id = orderId.trim(); if (!id) throw invalid();
  const query = new URLSearchParams({ id });
  const path = `/v1/mobile/admin/pending-orders?${query}`;
  const response = beforeSend ? await authorizedFetch(session, path, undefined, beforeSend) : await authorizedFetch(session, path);
  beforeSend?.();
  if (response.status !== 200) {
    let data: unknown; try { data = await response.json(); } catch { beforeSend?.(); data = null; }
    beforeSend?.();
    throw productionMapResponseError(response.status, data, 'pending_order_detail');
  }
  const json = await response.json();
  beforeSend?.();
  const row = object(json);
  if (!row || row.id !== id || !object(row.template)) throw invalid();
  const result = pendingOrderFromJson(row);
  beforeSend?.();
  return result;
}
/** @v2 pendingOrders */
export async function pendingOrders(session: Session) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/pending-orders');
  if (response.status !== 200) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw productionMapResponseError(response.status, data, 'pending_orders');
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new TypeError('Invalid pending orders');
  return payload.map(pendingOrderFromJson);
}
