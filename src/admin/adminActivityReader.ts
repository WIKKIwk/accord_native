import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { adminActivity } from './adminActivityApi';

/** The owner must still invalidate and remount on every account and scope transition. */
export function adminActivityReader(session: Session, isWitnessCurrent?: () => boolean): () => ReturnType<typeof adminActivity> {
  const scope = sessionReadScope(session);
  let retired = false;
  const current = () => {
    if (retired) return false;
    try {
      const witnessCurrent = isWitnessCurrent === undefined ||
        (typeof isWitnessCurrent === 'function' && isProfileSessionCurrent(isWitnessCurrent));
      if (!witnessCurrent || !activeSessionToken(session) || sessionReadScope(session) !== scope ||
          !canOpenRoute(session, appRoutes.adminActivity)) retired = true;
    } catch { retired = true; }
    return !retired;
  };
  const guard = () => {
    if (!current()) {
      throw new Error('Admin activity session changed');
    }
  };
  const readWitness = isWitnessCurrent === undefined ? undefined : current;
  return () => adminActivity(session, guard, readWitness);
}
