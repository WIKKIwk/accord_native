import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

/** Recheck on every transport attempt, including an automatic retry after a 401. */
export function additionalSettingsSendGuard(session: Session, witness?: SessionWitness, isCurrent?: () => boolean): () => void {
  const scope = sessionReadScope(session);
  const epoch = witness === undefined ? null : activeSessionEpoch(session);
  let retired = false;
  return () => {
    if (retired) throw new Error('Settings session changed');
    if (!activeSessionToken(session) || session.token === 'test-mode-token' || sessionReadScope(session) !== scope ||
        !canOpenRoute(session, appRoutes.adminAdditionalSettings) ||
        (witness !== undefined && (witness.session !== session || epoch === null || activeSessionEpoch(session) !== epoch || !isSessionWitnessCurrent(witness))) ||
        (isCurrent !== undefined && !isSynchronouslyTrue(isCurrent))) {
      retired = true;
      throw new Error('Settings session changed');
    }
  };
}
