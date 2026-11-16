import { activeSessionEpoch, activeSessionToken, isSessionWitnessCurrent, type Session, type SessionWitness } from '../auth';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { readAdminCustomerAvailableItems } from './adminCustomerDetailApi';
import { adminSupplierDetail } from './adminSupplierDetailApi';
import { adminAssignedSupplierItems, adminAssignSupplierItem, adminRemoveSupplierItem } from './adminSupplierItemsApi';
import { AdminSupplierItemsController } from './adminSupplierItemsController';

export function createAdminSupplierItemsSession(session: Session, witness: SessionWitness, isCurrent: () => boolean, ref: string, mode: 'add' | 'view') {
  const epoch = activeSessionEpoch(session), scope = sessionReadScope(session), route = mode === 'add' ? appRoutes.adminSupplierItemsAdd : appRoutes.adminSupplierItemsView;
  let retired = false, checking = false;
  const current = () => {
    if (retired || checking) { retired = true; return false; } checking = true;
    try {
      const valid = () => epoch !== null && activeSessionEpoch(session) === epoch && !!activeSessionToken(session) && session.token !== 'test-mode-token' &&
        witness.session === session && isSessionWitnessCurrent(witness) && sessionReadScope(session) === scope && canOpenRoute(session, route);
      if (!valid() || !isSynchronouslyTrue(isCurrent) || !valid() || retired) retired = true; return !retired;
    } catch { retired = true; return false; } finally { checking = false; }
  };
  return { current, controller: new AdminSupplierItemsController({ mode, isCurrent: current,
    detail: (guard, readWitness) => adminSupplierDetail(session, ref, guard, readWitness), assigned: (guard, readWitness) => adminAssignedSupplierItems(session, ref, guard, readWitness),
    all: (guard, readWitness) => readAdminCustomerAvailableItems(session, guard, readWitness),
    mutate: (item, guard) => mode === 'add' ? adminAssignSupplierItem(session, ref, item.code, guard) : adminRemoveSupplierItem(session, ref, item.code, guard),
  }) };
}
