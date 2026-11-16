import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

/** Original mounted Customer management child; false authority never revives after account restoration. */
export function adminCustomerChildScope(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  return () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope &&
        session.profile.role !== 'sales_manager' && (session.capabilities.includes('admin.access') || (session.profile.role === 'brigader' && session.capabilities.includes('brigader.access'))) &&
        canOpenRoute(session, appRoutes.adminCustomerDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true;
      return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
}
