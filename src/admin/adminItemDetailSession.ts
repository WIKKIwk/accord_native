import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminItemDetail } from './adminItemDetailApi';
import { AdminItemDetailController } from './adminItemDetailController';

/** Captures read authority through parent blur; the caller's current callback must represent the original account/page lifetime. */
export function createAdminItemDetailSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, itemCode: string) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminItemDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return { current, controller: new AdminItemDetailController(itemCode, { isCurrent: current,
    read: (code, guard, readWitness) => adminItemDetail(session, code, { includeImage: true }, guard, readWitness) }) };
}
