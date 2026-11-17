import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { adminInactiveSuppliers } from './adminInactiveSuppliersApi';
import { AdminInactiveSuppliersController } from './adminInactiveSuppliersController';
import { adminRestoreSupplier, adminSetSupplierBlocked } from './adminSupplierDetailApi';

export function createAdminInactiveSuppliersSession(session: Session, witness: SessionWitness, isCurrent: () => boolean) {
  const parent = createProfileSessionGuard(isCurrent), epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let retired = false;
  const current = () => {
    if (retired) return false;
    const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) &&
      session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
      sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminInactiveSuppliers);
    if (!valid() || !parent() || !valid()) retired = true;
    return !retired;
  };
  const controller = new AdminInactiveSuppliersController({ isCurrent: current,
    read: (guard, readWitness) => adminInactiveSuppliers(session, guard, readWitness),
    restore: (ref, guard) => adminRestoreSupplier(session, ref, guard),
    unblock: (ref, guard) => adminSetSupplierBlocked(session, ref, false, guard) });
  return { controller, current };
}
