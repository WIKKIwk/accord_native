import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';

/** Original account authority for Warehouse children. Parent focus is deliberately a separate concern. */
export function adminWarehouseItemRollsAuthority(session: Session, witness: SessionWitness, outer: () => boolean) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), name = session.profile.display_name;
  let retired = false, checking = false;
  return () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && session.profile.display_name === name && canOpenRoute(session, appRoutes.adminWarehouses);
      if (!valid() || !isSynchronouslyTrue(outer) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
}
