import { activeSessionToken, type Session } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';

/** Recheck on every transport attempt, including an automatic retry after a 401. */
export function additionalSettingsSendGuard(session: Session): () => void {
  const scope = sessionReadScope(session);
  return () => {
    if (!activeSessionToken(session) || sessionReadScope(session) !== scope || !canOpenRoute(session, appRoutes.adminAdditionalSettings)) {
      throw new Error('Settings session changed');
    }
  };
}
