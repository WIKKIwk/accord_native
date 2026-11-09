import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { dartTrim } from './dartJsonString';

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid warehouse stock object');
  return value as JsonObject;
}
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid warehouse stock string');
  return value;
}
function numeric(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid warehouse stock number');
  return value;
}
function integer(value: unknown): number {
  const n = numeric(value);
  if (!Number.isFinite(n)) throw new RangeError('Invalid warehouse stock integer');
  return Math.trunc(n);
}
/** @v2 AdminWarehouseStockItem */
export type AdminWarehouseStockItem = { code: string; name: string; uom: string; warehouse: string; order_id: string;
  item_group: string; on_hand_qty: number; package_count: number };
export function adminWarehouseStockItemFromJson(value: unknown): AdminWarehouseStockItem {
  const row = object(value);
  return { code: text(row.code), name: text(row.name), uom: text(row.uom), warehouse: text(row.warehouse),
    order_id: text(row.order_id), item_group: text(row.item_group), on_hand_qty: numeric(row.on_hand_qty),
    package_count: integer(row.package_count) };
}
/** @v2 AdminWarehouseStockRoll */
export type AdminWarehouseStockRoll = { stock_id: string; warehouse: string; item_code: string; order_id: string;
  paddon_code: string; progress_batch_id: string; barcode: string; qty: number; uom: string;
  accepted_by_display_name: string; accepted_at_unix: number };
export function adminWarehouseStockRollFromJson(value: unknown): AdminWarehouseStockRoll {
  const row = object(value);
  return { stock_id: text(row.stock_id), warehouse: text(row.warehouse), item_code: text(row.item_code), order_id: text(row.order_id),
    paddon_code: text(row.paddon_code), progress_batch_id: text(row.progress_batch_id), barcode: text(row.barcode),
    qty: numeric(row.qty), uom: text(row.uom), accepted_by_display_name: text(row.accepted_by_display_name),
    accepted_at_unix: integer(row.accepted_at_unix) };
}
async function responseList(response: Response, failure: string): Promise<unknown[]> {
  if (response.status !== 200) throw new Error(failure);
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid warehouse stock list');
  return value;
}
/** @v2 adminWarehouseItemsPage */
export async function adminWarehouseItemsPage(session: Session, warehouse: string,
  options: { query?: string; limit?: number; offset?: number } = {}): Promise<AdminWarehouseStockItem[]> {
  const normalized = dartTrim(warehouse);
  if (!normalized) return [];
  const query = new URLSearchParams({ warehouse: normalized }), search = dartTrim(options.query ?? '');
  const limit = options.limit ?? 80, offset = options.offset ?? 0;
  if (search) query.set('q', search);
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  const response = await authorizedFetch(session, `/v1/mobile/admin/warehouses/items?${query}`);
  return (await responseList(response, 'Admin warehouse items failed')).map(adminWarehouseStockItemFromJson);
}
/** @v2 adminWarehouseItemRolls */
export async function adminWarehouseItemRolls(session: Session, warehouse: string, itemCode: string,
  options: { orderId?: string; limit?: number; offset?: number } = {}): Promise<AdminWarehouseStockRoll[]> {
  const normalized = dartTrim(warehouse), code = dartTrim(itemCode);
  if (!normalized || !code) return [];
  const query = new URLSearchParams({ warehouse: normalized, item_code: code }), order = dartTrim(options.orderId ?? '');
  const limit = options.limit ?? 500, offset = options.offset ?? 0;
  if (order) query.set('order_id', order);
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  const response = await authorizedFetch(session, `/v1/mobile/admin/warehouses/items/rolls?${query}`);
  return (await responseList(response, 'Admin warehouse rolls failed')).map(adminWarehouseStockRollFromJson);
}
