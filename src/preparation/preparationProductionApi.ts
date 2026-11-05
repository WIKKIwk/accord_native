import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { preparationProductionBatchPageFromJson, preparationProductionOrderPageFromJson, preparationProductionOrdersPageFromJson } from './preparationProductionModel';
import { preparationGuard, preparationResponse, withQuery } from './preparationRequest';

async function read(session: Session, path: string, query: Record<string, string>) {
  const scope = sessionReadScope(session), accountGuard = preparationGuard(session);
  const guard = () => { accountGuard(); if (sessionReadScope(session) !== scope) throw new Error('Akkaunt o‘zgargan'); };
  const response = await authorizedFetch(session, withQuery(`/v1/mobile/preparation/production/${path}`, query), {}, guard);
  guard(); return preparationResponse(response);
}
/** @v2 preparationProductionOrders */
export async function preparationProductionOrders(session: Session, options: { query?: string; status?: string; offset?: number } = {}) {
  const status = options.status ?? 'all', offset = options.offset ?? 0;
  if (!['all', 'active', 'completed'].includes(status) || offset < 0 || !Number.isInteger(offset)) throw new Error('Ishlab chiqarish filtri noto‘g‘ri');
  return preparationProductionOrdersPageFromJson(await read(session, 'orders', { q: (options.query ?? '').trim(), status, offset: String(offset), limit: '50' }));
}
/** @v2 preparationProductionOrder */
export async function preparationProductionOrder(session: Session, orderId: string, offset = 0) {
  const id = orderId.trim();
  if (!id || offset < 0 || !Number.isInteger(offset)) throw new Error('Buyurtma tanlanmagan');
  const result = preparationProductionOrderPageFromJson(await read(session, 'order', { order_id: id, offset: String(offset), limit: '30' }));
  if (result.order.order_id !== id) throw new Error('Buyurtma mos kelmadi');
  return result;
}
/** @v2 preparationProductionBatch */
export async function preparationProductionBatch(session: Session, batchId: string, offset = 0) {
  const id = batchId.trim();
  if (!id || offset < 0 || !Number.isInteger(offset)) throw new Error('Ishlab chiqarish tanlanmagan');
  const result = preparationProductionBatchPageFromJson(await read(session, 'batch', { batch_id: id, offset: String(offset), limit: '50' }));
  if (result.batch.batch_id !== id) throw new Error('Ishlab chiqarish mos kelmadi');
  return result;
}
