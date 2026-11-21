import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { sessionReadScope } from '../sessionReadScope';
import { preparationProductionBatchPageFromJson, preparationProductionBatchesPageFromJson, preparationProductionOrderPageFromJson,
  preparationProductionOrdersPageFromJson, preparationProductionRollsPageFromJson } from './preparationProductionModel';
import { preparationGuard, preparationResponse, withQuery } from './preparationRequest';

async function read(session: Session, path: string, query: Record<string, string>) {
  const scope = sessionReadScope(session), accountGuard = preparationGuard(session);
  const guard = () => { accountGuard(); if (sessionReadScope(session) !== scope) throw new Error('Akkaunt o‘zgargan'); };
  const response = await authorizedFetch(session, withQuery(`/v1/mobile/preparation/production/${path}`, query), {}, guard);
  guard();
  const data = await preparationResponse(response);
  guard();
  return data;
}
type ListOptions = { query?: string; status?: string; offset?: number };

function listQuery(options: ListOptions) {
  const status = options.status ?? 'all', offset = options.offset ?? 0;
  if (!['all', 'active', 'completed'].includes(status) || offset < 0 || !Number.isInteger(offset)) throw new Error('Ishlab chiqarish filtri noto‘g‘ri');
  return { q: Array.from((options.query ?? '').trim()).slice(0, 200).join(''), status, offset: String(offset), limit: '50' };
}

/** @v2 preparationProductionOrders */
export async function preparationProductionOrders(session: Session, options: ListOptions = {}) {
  return preparationProductionOrdersPageFromJson(await read(session, 'orders', listQuery(options)));
}

export async function preparationProductionBatches(session: Session, options: ListOptions = {}) {
  return preparationProductionBatchesPageFromJson(await read(session, 'batches', listQuery(options)));
}

export async function preparationProductionRolls(session: Session, options: ListOptions = {}) {
  return preparationProductionRollsPageFromJson(await read(session, 'rolls', listQuery(options)));
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
