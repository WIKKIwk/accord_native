import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { loadAdminWarehouseAssignees } from './adminWarehouseAssignees';
import { AdminWarehouseCreateController } from './adminWarehouseCreateController';
import { adminAssignWarehouse } from './adminWarehouseAssignmentApi';
import { adminUserList, adminRoleAssignments } from './adminUsersApi';
import { adminCreateWarehouse } from './warehouseApi';

/** Retains the original account witness, read scope and epoch for the entire dialog, including cached users and both commands. */
export function adminWarehouseCreateSession(session: Session, witness: SessionWitness, isCurrent: () => boolean,
  callbacks: { onSaved: () => Promise<void>; onClose: () => void }) {
  const parentCurrent = createProfileSessionGuard(isCurrent);
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false;
  const current = () => {
    if (retired) return false;
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null &&
      session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
      sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminWarehouses);
    if (!check() || !parentCurrent() || !check()) { retired = true; return false; }
    return true;
  };
  return { current, controller: new AdminWarehouseCreateController({ isCurrent: current,
    users: (guard, readWitness) => loadAdminWarehouseAssignees({
      users: (role, offset, g, w) => adminUserList(session, { role, limit: 50, offset }, g, w),
      assignments: (g, w) => adminRoleAssignments(session, g, w),
    }, guard, readWitness),
    create: (name, guard) => adminCreateWarehouse(session, name, guard),
    assign: (input, guard) => adminAssignWarehouse(session, input, guard), ...callbacks,
  }) };
}
