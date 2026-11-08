import type { Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { dispatchRecordFromJson, type DispatchRecord } from '../shared/notificationApi';

/** @v2 adminActivity */
export async function adminActivity(session: Session): Promise<DispatchRecord[]> {
  const response = await authorizedFetch(session, '/v1/mobile/admin/activity');
  if (response.status !== 200) throw new Error('Admin activity failed');
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new TypeError('Invalid admin activity list');
  return value.map(dispatchRecordFromJson);
}
