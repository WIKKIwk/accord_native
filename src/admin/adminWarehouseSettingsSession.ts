import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { adminUserList, adminRoleAssignments } from './adminUsersApi';
import { loadAdminWarehouseAssignees } from './adminWarehouseAssignees';
import { adminAssignWarehouse } from './adminWarehouseAssignmentApi';
import { adminWarehouseSettingsAssignments, adminUnassignWarehouse } from './adminWarehouseSettingsApi';
import { AdminWarehouseSettingsController } from './adminWarehouseSettingsController';
import { adminDeleteWarehouse } from './warehouseApi';
import { adminUserPrincipalRoleFromJson } from './adminUsersModel';

/** Original authority is captured once; view focus is a separate interaction fence in the hook. */
export function adminWarehouseSettingsSession(session: Session, witness: SessionWitness, isCurrent: () => boolean,
  callbacks: { onChanged: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const parentCurrent = createProfileSessionGuard(isCurrent);
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false;
  const current = () => {
    if (retired) return false;
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && activeSessionToken(session) !== null &&
      session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
      sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminWarehouses);
    if (!check() || !parentCurrent() || !check()) { retired = true; return false; } return true;
  };
  return { current, controller: new AdminWarehouseSettingsController({ isCurrent: current,
    users: (guard, readWitness) => loadAdminWarehouseAssignees({ users: (role, offset, g, w) => adminUserList(session, { role, offset, limit: 50 }, g, w),
      assignments: (g, w) => adminRoleAssignments(session, g, w) }, guard, readWitness),
    assignments: (warehouse, guard, readWitness) => adminWarehouseSettingsAssignments(session, warehouse, guard, readWitness),
    assign: (input, guard) => adminAssignWarehouse(session, input, guard),
    unassign: (assignment, guard) => adminUnassignWarehouse(session, { ...assignment, principal_role: adminUserPrincipalRoleFromJson(assignment.principal_role) }, guard),
    deleteWarehouse: (warehouse, deleteProducts, guard) => adminDeleteWarehouse(session, warehouse, deleteProducts, guard), ...callbacks,
  }) };
}
