import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminDeleteItemDetail, adminItemDetail, adminItemDetailCustomers, adminItemDetailGroups, adminSetItemDetailCustomerAssigned, adminUpdateItemDetail, adminUpdateItemDetailGroup } from './adminItemDetailApi';
import { AdminItemDetailDecisionController } from './adminItemDetailDecisionController';

/** Original account/page lifetime is separate from the future native focus/interaction facade. */
export function createAdminItemDetailDecisionSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, itemCode: string) {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session); let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, appRoutes.adminItemDetail);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return { current, controller: new AdminItemDetailDecisionController(itemCode, { isCurrent: current,
    read: (code, guard, readWitness) => adminItemDetail(session, code, { includeImage: true }, guard, readWitness),
    rename: (detail, draft, guard) => adminUpdateItemDetail(session, { originalCode: detail.code, code: draft.code, name: draft.name }, guard),
    remove: (detail, guard) => adminDeleteItemDetail(session, detail.code, guard), groups: (guard, readWitness) => adminItemDetailGroups(session, guard, readWitness),
    moveGroup: (detail, group, guard, readWitness) => adminUpdateItemDetailGroup(session, detail.code, group, guard, readWitness),
    customers: (query, guard, readWitness) => adminItemDetailCustomers(session, query, guard, readWitness),
    setCustomer: (detail, customer, assigned, guard, readWitness) => adminSetItemDetailCustomerAssigned(session, detail.code, customer, assigned, guard, readWitness),
  }) };
}
