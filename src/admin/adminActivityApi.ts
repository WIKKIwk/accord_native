import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { dispatchRecordFromJson, type DispatchRecord } from '../shared/notificationApi';
import { checkedAdminGuard, type AdminRequestGuard } from './adminProductionRequest';

/** @v2 adminActivity */
export async function adminActivity(session: Session, guard?: AdminRequestGuard, readWitness?: () => boolean): Promise<DispatchRecord[]> {
  const check = checkedAdminGuard(guard); check?.();
  if (readWitness !== undefined && (typeof readWitness !== 'function' || !check)) throw new TypeError('Scoped activity read requires a guard and witness');
  let response: Response;
  try { response = readWitness ? await authorizedFetch(session, '/v1/mobile/admin/activity', undefined, check, 10_000, { readWitness })
    : await authorizedFetch(session, '/v1/mobile/admin/activity', undefined, check); }
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
