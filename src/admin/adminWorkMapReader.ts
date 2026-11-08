import { activeSessionToken, type Session } from '../auth';
import { adminProductionOrderDetail } from '../productionOrderDetailApi';
import { pendingOrderDetail } from '../pendingOrderApi';
import { adminProductionOrderPage, type ProductionOrderPageRequest } from '../productionOrderPageApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { checkedAdminGuard } from './adminProductionRequest';
import type { AdminWorkMapDetailTicket, AdminWorkMapPage } from './adminWorkMapController';

/** Capture one witness and one read scope for this screen; never recapture a stale operation. */
function adminWorkMapGuard(session: Session, isWitnessCurrent: () => boolean) {
  const scope = sessionReadScope(session);
  const guard = checkedAdminGuard(() => {
    if (!activeSessionToken(session) || !isProfileSessionCurrent(isWitnessCurrent) || sessionReadScope(session) !== scope ||
        !canOpenRoute(session, appRoutes.adminProductionMapOrders)) throw new Error('Admin work map session changed');
  })!;
  return guard;
}
export function adminWorkMapReader(session: Session, isWitnessCurrent: () => boolean) {
  const guard = adminWorkMapGuard(session, isWitnessCurrent);
  return async (request: ProductionOrderPageRequest): Promise<AdminWorkMapPage | null> => {
    guard(); const page = await adminProductionOrderPage(session, request, guard); guard();
    return page as AdminWorkMapPage | null;
  };
}

/** A list summary never authorizes an editor: hydrate and validate the full response first. */
export function adminWorkMapDetailReader(session: Session, isWitnessCurrent: () => boolean) {
  const guard = adminWorkMapGuard(session, isWitnessCurrent);
  return async (ticket: AdminWorkMapDetailTicket) => {
    guard();
    if (ticket.kind === 'pending') {
      const detail = await pendingOrderDetail(session, ticket.id, guard); guard();
      return { kind: 'pending' as const, template: detail.template };
    }
    const snapshot = await adminProductionOrderDetail(session, { apparatus: '', order_id: ticket.id }, guard);
    guard();
    if (snapshot.epoch !== ticket.epoch || snapshot.revision == null || ticket.revision == null || snapshot.revision < ticket.revision || !snapshot.scope) {
      throw new Error('Buyurtma yangilandi. Qayta oching.');
    }
    return { kind: 'order' as const, map: snapshot.maps[0].map };
  };
}
