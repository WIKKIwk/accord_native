import type { Session } from './auth';
import { postWorkerApiRequest } from './workerControlsApi';
import { qolipProductFromJson } from './qolipCatalogApi';
/** @v2 qolipOrderProducts */
export async function qolipOrderProducts(session: Session, orderIds: string[]) {
  if (!orderIds.length) return {};
  const ids = orderIds.map(id => id.trim());
  if (ids.length > 50 || ids.some(id => !id)) throw new TypeError('Expected at most 50 non-empty order IDs');
  const payload = await postWorkerApiRequest(session, '/v1/mobile/qolip/order-products', { order_ids: ids }, null, false, 'qolip_order_products_failed');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Invalid Qolip readiness response');
  const raw = (payload as { orders?: unknown }).orders;
  if (raw != null && !Array.isArray(raw)) throw new TypeError('Invalid Qolip readiness response');
  const result: Record<string, ReturnType<typeof qolipProductFromJson> | null> = {};
  for (const value of raw ?? []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, any>, product = row.product;
    result[row.order_id == null ? 'null' : String(row.order_id)] = product && typeof product === 'object' && !Array.isArray(product) ? qolipProductFromJson(product) : null;
  }
  if (ids.some(id => !Object.hasOwn(result, id))) throw new TypeError('Incomplete Qolip readiness response');
  return result;
}
