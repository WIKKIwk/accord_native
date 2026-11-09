import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { dispatchRecordFromJson, type DispatchRecord } from '../shared/notificationApi';
import { checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';

/** @v2 adminActivity */
export async function adminActivity(session: Session, guard?: AdminRequestGuard): Promise<DispatchRecord[]> {
  const check = checkedAdminGuard(guard); check?.();
  let response: Response;
  try { response = await authorizedFetch(session, '/v1/mobile/admin/activity', undefined, check); }
  catch (error) { check?.(); throw error; }
  check?.();
  if (response.status !== 200) throw new Error('Admin activity failed');
  let value: unknown;
  try { value = await response.json(); } catch (error) { check?.(); throw error; }
  check?.();
  if (!Array.isArray(value)) throw new TypeError('Invalid admin activity list');
  const result = value.map(dispatchRecordFromJson);
  check?.(); return result;
}
