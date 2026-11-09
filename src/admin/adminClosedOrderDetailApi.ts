import type { Session } from '../auth';
import { closedProductionOrderFromJson } from '../workerClosedOrders';
import { adminProductionRequest, checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';

/** Admin-only guarded form of the source Closed history read; existing Worker defaults stay untouched. */
export async function adminClosedOrderDetail(session: Session, id: string, guard: AdminRequestGuard) {
  const check = checkedAdminGuard(guard);
  if (!check) throw new TypeError('Admin closed history guard required');
  check();
  const query = new URLSearchParams({ id });
  const payload = await adminProductionRequest(session, `/v1/mobile/admin/production-maps/closed-order?${query}`, undefined, 'closed_order_failed', check);
  check();
  const detail = closedProductionOrderFromJson(payload);
  check();
  return detail;
}
