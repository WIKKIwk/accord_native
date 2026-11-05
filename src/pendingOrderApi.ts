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
export async function pendingOrderDetail(session: Session, orderId: string) {
  const id = orderId.trim(); if (!id) throw invalid();
  const query = new URLSearchParams({ id });
  const response = await authorizedFetch(session, `/v1/mobile/admin/pending-orders?${query}`);
  if (response.status !== 200) {
    let data: unknown; try { data = await response.json(); } catch { data = null; }
    throw productionMapResponseError(response.status, data, 'pending_order_detail');
  }
  const row = object(await response.json());
  if (!row || row.id !== id || !object(row.template)) throw invalid();
  return pendingOrderFromJson(row);
}
