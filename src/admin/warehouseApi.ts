import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { adminWarehouseFromJson, type GScaleAdminWarehouse } from '../gscale/gscaleAdminApi';
import { MobileApiException } from '../shared/mobileApiException';
import { adminApiError } from './adminApiError';
import { dartJsonString, dartTrim } from './dartJsonString';

/** @v2 AdminWarehouseSummary */
export type AdminWarehouseSummary = { warehouse: string; product_count: number; reserved_count: number;
  assignment_count: number; assigned_display_names: string[] };
function intOrZero(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number') throw new TypeError('Invalid warehouse summary count');
  return Math.trunc(value);
}
export function adminWarehouseSummaryFromJson(value: unknown): AdminWarehouseSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid warehouse summary');
  const row = value as Record<string, unknown>;
  const warehouse = row.warehouse == null ? '' : dartJsonString(row.warehouse);
  const product_count = intOrZero(row.product_count), reserved_count = intOrZero(row.reserved_count);
  const assignment_count = intOrZero(row.assignment_count), names = row.assigned_display_names ?? [];
  if (!Array.isArray(names)) throw new TypeError('Invalid warehouse assignee names');
  return { warehouse, product_count, reserved_count, assignment_count,
    assigned_display_names: names.map(dartJsonString).filter(name => dartTrim(name).length > 0) };
}
/** @v2 adminWarehouseSummaries */
export async function adminWarehouseSummaries(session: Session, options: { query?: string; limit?: number } = {}): Promise<AdminWarehouseSummary[]> {
  const query = new URLSearchParams(), search = dartTrim(options.query ?? ''), limit = options.limit ?? 50;
  if (search) query.set('q', search);
  if (limit > 0) query.set('limit', String(limit));
  const suffix = query.toString(), path = '/v1/mobile/admin/warehouses/summary';
  const response = await authorizedFetch(session, suffix ? `${path}?${suffix}` : path);
  if (response.status !== 200) throw new Error('Admin warehouse summaries failed');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid warehouse summaries list');
  return value.map(adminWarehouseSummaryFromJson);
}
/** @v2 adminCreateWarehouse */
export async function adminCreateWarehouse(session: Session, warehouse: string): Promise<GScaleAdminWarehouse> {
  const name = dartTrim(warehouse);
  if (!name) throw new Error('Admin warehouse name required');
  const response = await authorizedFetch(session, '/v1/mobile/admin/warehouses', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warehouse: name }) });
  if (response.status !== 200) throw new Error('Admin warehouse create failed');
  return adminWarehouseFromJson(await response.json());
}
/** @v2 adminDeleteWarehouse */
export async function adminDeleteWarehouse(session: Session, warehouse: string, deleteProducts: boolean): Promise<void> {
  const normalized = dartTrim(warehouse);
  if (!normalized) throw new MobileApiException({ code: 'warehouse_required', message: 'Ombor tanlanmagan' });
  const response = await authorizedFetch(session, '/v1/mobile/admin/warehouses', { method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ warehouse: normalized, delete_products: deleteProducts }) });
  if (response.status !== 200) throw await adminApiError(response, 'warehouse_delete_failed', 'Ombor o‘chirilmadi');
}
