import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { createProfileSessionGuard } from '../shared/profileSessionGuard';
import { adminCustomerUpsertRoleAssignment } from './adminCustomerDetailApi';
import type { AdminRolesScreenProps } from './AdminRolesTypes';
import { adminRolesFetch, adminRolesSave } from './adminRolesApi';
import { AdminRolesController } from './adminRolesController';

export function adminRolesSession({ session, witness, isCurrent }: Pick<AdminRolesScreenProps, 'session' | 'witness' | 'isCurrent'>) {
  const parent = createProfileSessionGuard(isCurrent), epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false;
  const current = () => {
    if (retired) return false;
    const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
      witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminRoles);
    try { if (!valid() || !parent() || !valid()) retired = true; } catch { retired = true; }
    return !retired;
  };
  return { current, controller: new AdminRolesController({ isCurrent: current,
    read: (guard, readWitness) => adminRolesFetch(session, guard, readWitness), saveRole: (role, guard) => adminRolesSave(session, role, guard),
    saveAssignment: (assignment, guard) => adminCustomerUpsertRoleAssignment(session, assignment, guard) }) };
}
