import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import type { SupplierItem } from '../shared/catalogApi';
import { productionMapResponseError } from '../workerControlsApi';
import { productionMapSavedFromJson } from '../workerProductionMapSaved';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid object');
  return value as ObjectValue;
}
function string(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid string');
  return value;
}
function list(value: unknown): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid list');
  return value;
}
function supplierItem(value: unknown): SupplierItem {
  const row = object(value), options = row.order_apparatus_options == null ? {} : object(row.order_apparatus_options);
  return { code: string(row.code), name: string(row.name), uom: string(row.uom), warehouse: string(row.warehouse),
    item_group: string(row.item_group), requires_dimensions: row.requires_dimensions === true,
    order_apparatus_options: Object.fromEntries(Object.entries(options).map(([key, value]) => [key, String(value)])),
    order_microns: list(row.order_microns).filter((value): value is number => typeof value === 'number'),
    customer_names: list(row.customer_names).map(value => String(value).trim()).filter(Boolean) };
}
async function responseList(response: Response): Promise<unknown[]> {
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid list');
  return value;
}

/** @v2 adminItemsPage */
export async function adminItemsPage(session: Session, options: { query?: string; group?: string; limit?: number; offset?: number } = {}): Promise<SupplierItem[]> {
  const query = new URLSearchParams(), limit = options.limit ?? 50, offset = options.offset ?? 0;
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (options.group?.trim()) query.set('group', options.group.trim());
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  const path = '/v1/mobile/admin/items', suffix = query.toString();
  const response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path);
  if (response.status !== 200) throw new Error('Admin items failed');
  return (await responseList(response)).map(supplierItem);
}

export type GScaleAdminWarehouse = { warehouse: string; company: string; is_group: boolean; parent_warehouse: string };

/** @v2 AdminWarehouse.fromJson */
export function adminWarehouseFromJson(value: unknown): GScaleAdminWarehouse {
  const row = object(value);
  return { warehouse: string(row.warehouse), company: string(row.company), is_group: row.is_group === true,
    parent_warehouse: string(row.parent_warehouse ?? row.parent) };
}

/** @v2 adminWarehouses */
export async function adminWarehouses(session: Session, options: { query?: string; parent?: string; limit?: number } = {}): Promise<GScaleAdminWarehouse[]> {
  const query = new URLSearchParams(), limit = options.limit ?? 50;
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (options.parent?.trim()) query.set('parent', options.parent.trim());
  if (limit > 0) query.set('limit', String(limit));
  const path = '/v1/mobile/admin/warehouses', suffix = query.toString();
  const response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path);
  if (response.status !== 200) throw new Error('Admin warehouses failed');
  return (await responseList(response)).map(adminWarehouseFromJson);
}

/** @v2 adminRawMaterialAssignmentOrders */
export async function adminRawMaterialAssignmentOrders(session: Session, beforeSend?: () => void) {
  const path = '/v1/mobile/admin/raw-material-assignments/orders';
  const response = beforeSend ? await authorizedFetch(session, path, {}, beforeSend) : await authorizedFetch(session, path);
  if (response.status !== 200) {
    let payload: unknown;
    try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'raw_material_assignment_orders');
  }
  return (await responseList(response)).map(productionMapSavedFromJson);
}
