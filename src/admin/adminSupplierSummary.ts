import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';

/** @v2 AdminSupplierSummary */
export type AdminSupplierSummary = { total_suppliers: number; active_suppliers: number; blocked_suppliers: number };
export const emptyAdminSupplierSummary = (): AdminSupplierSummary => ({ total_suppliers: 0, active_suppliers: 0, blocked_suppliers: 0 });
function integer(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('Invalid supplier summary count');
  return value;
}
export function adminSupplierSummaryFromJson(value: unknown): AdminSupplierSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid supplier summary');
  const row = value as Record<string, unknown>;
  return { total_suppliers: integer(row.total_suppliers), active_suppliers: integer(row.active_suppliers),
    blocked_suppliers: integer(row.blocked_suppliers) };
}
/** @v2 adminSupplierSummary */
export async function adminSupplierSummary(session: Session, beforeSend?: () => void): Promise<AdminSupplierSummary> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/suppliers/summary', undefined, beforeSend);
  if (response.status !== 200) throw new Error('Admin supplier summary failed');
  return adminSupplierSummaryFromJson(await response.json());
}
