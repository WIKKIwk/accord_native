import type { Session } from '../auth';
import { calculateOrderTemplateFromJson } from '../workerOpenedOrderEditApi';
import { adminProductionRequest, checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
export type AdminOrderSummary = ReturnType<typeof calculateOrderTemplateFromJson>;

/** Source live read only. The caller must bind the guard to its original hydrated detail ticket. */
export async function adminProductionMapOrderSummary(session: Session, orderId: string, guard: AdminRequestGuard): Promise<AdminOrderSummary> {
  const check = checkedAdminGuard(guard);
  if (!check) throw new TypeError('Admin order summary guard required');
  check();
  const id = dartTrim(orderId), query = new URLSearchParams({ id });
  const payload = object(await adminProductionRequest(session, `/v1/mobile/admin/production-maps/order-summary?${query}`, undefined, 'order_summary', check));
  check();
  const raw = object(payload?.template);
  if (!raw) throw new TypeError('Invalid order summary');
  // V2 overrides legacy width-based inference: a saved calculation needs an explicit numeric frame count.
  const template = calculateOrderTemplateFromJson({ ...raw, frame_count: typeof raw.frame_count === 'number' ? raw.frame_count : 0 });
  check();
  if (dartTrim(template.source_map_id) !== id) throw new TypeError('Order summary identity mismatch');
  return template;
}
