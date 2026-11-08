import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminActivity } from './adminActivityApi';

/** The owner must still invalidate and remount on every account and scope transition. */
export function adminActivityReader(session: Session): () => ReturnType<typeof adminActivity> {
  const scope = sessionReadScope(session);
  const guard = () => {
    if (!activeSessionToken(session) || sessionReadScope(session) !== scope || !canOpenRoute(session, appRoutes.adminActivity)) {
      throw new Error('Admin activity session changed');
    }
  };
  return () => adminActivity(session, guard);
}
