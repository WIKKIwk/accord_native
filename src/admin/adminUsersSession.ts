import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { adminRoleAssignments, adminUserList } from './adminUsersApi';
import { AdminUsersController } from './adminUsersController';
import type { AdminUsersCache } from './adminUsersCache';
import type { AdminUsersRoleStore } from './adminUsersRoleStore';
import { adminUsersCache, adminUsersRoleStore } from './adminUsersRuntime';

/** One original witness/epoch/scope owns list reads, preferences, cache publication and detail-return callbacks. */
export function createAdminUsersSession(session: Session, witness: SessionWitness, isCurrent: () => boolean,
  stores: { cache: AdminUsersCache; roles: AdminUsersRoleStore } = { cache: adminUsersCache, roles: adminUsersRoleStore }) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session);
  let attached = true, retired = false;
  const original = () => {
    if (retired) return false;
    const check = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) &&
      session.token !== 'test-mode-token' && witness.session === session && isSessionWitnessCurrent(witness) &&
      sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminSuppliers);
    try {
      if (!check() || !isProfileSessionCurrent(isCurrent) || !check()) retired = true;
    } catch { retired = true; }
    return !retired;
  };
  const current = () => attached && original();
  const controller = new AdminUsersController({ isCurrent: current, scope: () => sessionReadScope(session), revision: () => witness.generation,
    profileRef: typeof session.profile.ref === 'string' ? session.profile.ref : '', salesManager: session.profile.role === 'sales_manager',
    cache: stores.cache, roles: stores.roles,
    readPage: (options, guard, readWitness) => adminUserList(session, options, guard, readWitness),
    readAssignments: (guard, readWitness) => adminRoleAssignments(session, guard, readWitness) });
  return { controller, current, attach: () => { attached = true; }, detach: () => { attached = false; controller.dispose(); } };
}
