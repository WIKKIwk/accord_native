import { activeSessionToken, type Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
const str = (v: unknown) => v == null ? '' : String(v);
/** @v2 QolipProduct */
export function qolipProductFromJson(value: unknown) {
  const row = object(value); if (!row) throw new TypeError('Invalid qolip product');
  if (row.customer_names != null && !Array.isArray(row.customer_names)) throw new TypeError('Invalid customer names');
  if (row.size != null && typeof row.size !== 'number') throw new TypeError('Invalid qolip size');
  const code = str(row.code), warehouse = str(row.warehouse), rawSet = str(row.qolip_set_id);
  const item = code.trim().toLowerCase();
  return { is_extension: row.is_extension === true, qolip_set_id: rawSet, set_id: rawSet.trim() || `legacy:${Array.from(item).length}:${item}:${warehouse.trim().toLowerCase()}`,
    warehouse, code, name: str(row.name), item_group: str(row.item_group), customer_names: (row.customer_names ?? []).map((v: unknown) => str(v).trim()).filter(Boolean),
    qolip_code: str(row.qolip_code), first_qolip_code: str(row.first_qolip_code), size: Math.trunc(row.size ?? 0), color: str(row.color),
    has_qolip_spec: row.has_qolip_spec === true, is_in_use: row.is_in_use === true, is_in_rework: row.is_in_rework === true,
    order_image_order_id: str(row.order_image_order_id) };
}
export function qolipAccountGuard(session: Session) {
  const account = JSON.stringify([session.baseUrl, session.profile?.ref ?? null, session.profile?.role ?? null]);
  return () => { if (account !== JSON.stringify([session.baseUrl, session.profile?.ref ?? null, session.profile?.role ?? null]) || !activeSessionToken(session)) throw new Error('Qolip catalog account changed'); };
}
export async function qolipResponseError(response: Response, fallback = 'qolip_products_failed', message = 'Qoliplar yuklanmadi') {
  let data: Obj | null; try { data = object(await response.json()); } catch { data = null; }
  const code = data?.error ?? data?.code ?? fallback, server = str(data?.message).trim();
  return new WorkerControlException(str(code), server || message, response.status);
}
/** @v2 qolipCatalogDetails */
export async function qolipCatalogDetails(session: Session, id: string) {
  const guard = qolipAccountGuard(session), query = new URLSearchParams({ id });
  await Promise.resolve();
  const response = await authorizedFetch(session, `/v1/mobile/qolip/products/detail?${query}`, {}, guard);
  guard();
  if (response.status !== 200) throw await qolipResponseError(response);
  const data = object(await response.json());
  if (!data || !Array.isArray(data.products) || !data.products.length) throw new TypeError('Missing Qolip product details');
  return data.products.map(qolipProductFromJson);
}
/** @v2 qolipCatalogPage */
export async function qolipCatalogPage(session: Session, input: { query?: string; cursor?: string | null; limit?: number } = {}) {
  const count = Math.max(1, Math.min(200, Math.trunc(input.limit ?? 200))), guard = qolipAccountGuard(session);
  const query = new URLSearchParams({ limit: String(count) });
  if (input.query?.trim()) query.set('q', input.query.trim());
  if (input.cursor != null) query.set('cursor', input.cursor);
  await Promise.resolve();
  const response = await authorizedFetch(session, `/v1/mobile/qolip/products/page?${query}`, {}, guard);
  guard();
  if (response.status !== 200) throw await qolipResponseError(response);
  const data = object(await response.json()), raw = data?.items, next = data?.next_cursor;
  if (!data || !Array.isArray(raw) || raw.length > count || typeof data.has_more !== 'boolean' ||
      (data.has_more && (!raw.length || typeof next !== 'string' || !next || next === input.cursor))) throw new TypeError('Invalid Qolip catalog page');
  const ids = new Set<string>();
  const items = raw.map(value => {
    const row = object(value);
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string' || !row.id || ids.has(row.id) ||
        (row.order_image_order_id != null && typeof row.order_image_order_id !== 'string')) throw new TypeError('Invalid Qolip catalog item');
    ids.add(row.id);
    return { id: row.id, name: row.name, order_image_order_id: (row.order_image_order_id ?? '').trim() };
  });
  return { items, next_cursor: data.has_more ? next as string : null };
}
