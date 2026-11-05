import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { MobileApiException } from './mobileApiException';
import { appPreferences } from '../appPreferences';
import { SearchActivityStore } from './searchActivityStore';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid object');
  return value as Obj;
};
const text = (value: unknown) => value == null ? '' : String(value);
const typedText = (value: unknown) => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Invalid item string');
  return value;
};
const list = (value: unknown): unknown[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('Invalid item list');
  return value;
};
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
export const searchActivityStore = new SearchActivityStore(appPreferences);

export type SupplierItem = { code: string; name: string; uom: string; warehouse: string; item_group: string;
  requires_dimensions: boolean; order_apparatus_options: Record<string, string>; order_microns: number[]; customer_names: string[] };
export type GscaleItemsOptions = { query?: string; group?: string; orderId?: string; limit?: number; offset?: number; useBackend?: boolean };
function supplierItem(value: unknown): SupplierItem {
  const row = object(value);
  const options = row.order_apparatus_options == null ? {} : object(row.order_apparatus_options);
  return { code: typedText(row.code), name: typedText(row.name), uom: typedText(row.uom), warehouse: typedText(row.warehouse),
    item_group: typedText(row.item_group), requires_dimensions: row.requires_dimensions === true,
    order_apparatus_options: Object.fromEntries(Object.entries(options).map(([key, val]) => [key, String(val)])),
    order_microns: list(row.order_microns).filter((value): value is number => typeof value === 'number'),
    customer_names: list(row.customer_names).map(value => String(value).trim()).filter(Boolean) };
}

/** @v2 gscaleItemsPage */
export async function gscaleItemsPage(session: Session, options: GscaleItemsOptions = {}): Promise<SupplierItem[]> {
  const query = new URLSearchParams();
  if (options.query?.trim()) query.set('q', options.query.trim());
  if (options.group?.trim()) query.set('group', options.group.trim());
  if (options.orderId?.trim()) query.set('order_id', options.orderId.trim());
  const limit = options.limit ?? 80, offset = options.offset ?? 0;
  if (limit > 0) query.set('limit', String(limit));
  if (offset > 0) query.set('offset', String(offset));
  const path = '/v1/mobile/gscale/items', suffix = query.toString();
  const response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path);
  if (response.status !== 200) throw new MobileApiException({ code: 'gscale_items_failed', message: 'GScale items failed', statusCode: response.status });
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new TypeError('Invalid item list');
  return searchActivityStore.sortByItemCode(session, data.map(supplierItem), item => item.code,
    (left, right) => compare(left.name.toLowerCase(), right.name.toLowerCase()) || compare(left.code.toLowerCase(), right.code.toLowerCase()));
}

export type WarehouseAssignment = { warehouse: string; principal_role: string; principal_ref: string; display_name: string };
const roles = new Set(['supplier', 'werka', 'customer', 'aparatchi', 'qolipchi', 'boyoqchi', 'tayyorlov_masteri',
  'material_taminotchi', 'admin', 'homashyo_rezkachi', 'sales_manager', 'brigader', 'rezka_master']);
/** @v2 adminWarehouseAssignments */
export async function adminWarehouseAssignments(session: Session, warehouse = ''): Promise<WarehouseAssignment[]> {
  const query = new URLSearchParams();
  if (warehouse.trim()) query.set('warehouse', warehouse.trim());
  const path = '/v1/mobile/admin/warehouses/assignments', suffix = query.toString();
  const response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path);
  if (response.status !== 200) throw new Error('Admin warehouse assignments failed');
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new TypeError('Invalid assignments');
  return data.map(value => {
    const item = object(value), rawRole = text(item.principal_role).trim().toLowerCase();
    const role = rawRole === 'omborchi' ? 'werka' : rawRole;
    if (!roles.has(role)) throw new TypeError(`Unsupported user role: ${text(item.principal_role)}`);
    return { warehouse: text(item.warehouse), principal_role: role, principal_ref: text(item.principal_ref), display_name: text(item.display_name) };
  });
}
