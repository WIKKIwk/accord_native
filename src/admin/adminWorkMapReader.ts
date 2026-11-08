import { activeSessionToken, type Session } from '../auth';
import { adminApparatus } from '../apparatusApi';
import { adminProductionOrderDetail } from '../productionOrderDetailApi';
import { pendingOrderDetail } from '../pendingOrderApi';
import { adminProductionOrderPage, type ProductionOrderPageRequest } from '../productionOrderPageApi';
import { sessionReadScope } from '../sessionReadScope';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { isProfileSessionCurrent } from '../shared/profileSessionGuard';
import { MobileApiException } from '../shared/mobileApiException';
import { checkedAdminGuard } from './adminProductionRequest';
import type { AdminWorkMapDetailTicket, AdminWorkMapPage } from './adminWorkMapController';
import { adminWorkMapMetadataFromSaved } from './adminWorkMapMetadataModel';
import { adminProductionMapOrderSummary } from './adminOrderSummaryApi';
import { adminWorkMapOrderWeight } from './adminWorkMapOrderWeight';

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

/** V2 bootstraps the ordinary Admin catalog with limit 200 and no transient retry. */
export function adminWorkMapCatalogReader(session: Session, isWitnessCurrent: () => boolean) {
  const guard = adminWorkMapGuard(session, isWitnessCurrent);
  return async () => { guard(); const rows = await adminApparatus(session, { limit: 200, beforeSend: guard }); guard(); return rows; };
}

/** A saved calculation read belongs to the same hydrated detail ticket, not a list summary. */
export function adminWorkMapSummaryReader(session: Session, isWitnessCurrent: () => boolean) {
  const guard = adminWorkMapGuard(session, isWitnessCurrent);
  return async (id: string) => { guard(); const value = await adminProductionMapOrderSummary(session, id, guard); guard(); return value; };
}

/** A list summary never authorizes an editor: hydrate and validate the full response first. */
export function adminWorkMapDetailReader(session: Session, isWitnessCurrent: () => boolean) {
  const guard = adminWorkMapGuard(session, isWitnessCurrent);
  return async (ticket: AdminWorkMapDetailTicket) => {
    guard();
    if (ticket.kind === 'pending') {
      const detail = await pendingOrderDetail(session, ticket.id, guard); guard();
      return { kind: 'pending' as const, template: detail.template, managerName: detail.manager_name };
    }
    // V2 retries a stale detail once, not a failed HTTP request. Every retry
    // still belongs to the original list ticket and session witness.
    for (let attempt = 0; attempt < 2; attempt++) {
      guard();
      const snapshot = await adminProductionOrderDetail(session, { apparatus: ticket.apparatus ?? '', order_id: ticket.id }, guard);
      guard();
      if (snapshot.epoch === ticket.epoch && snapshot.revision != null && ticket.revision != null && snapshot.revision >= ticket.revision &&
          snapshot.scope && snapshot.maps.length === 1 && snapshot.maps[0].map.id === ticket.id) {
        const saved = snapshot.maps[0], map = saved.map, customers = snapshot.order_customers ?? {};
        const metadata = adminWorkMapMetadataFromSaved(saved);
        guard();
        // Compact Orders detail computes this fallback from its hydrated templates; Sequence and legacy full pages use different metric flows.
        const orderWeight = ticket.ordersSummary ? adminWorkMapOrderWeight(map, Object.values(snapshot.calculation_templates ?? {})) : null;
        return { kind: 'order' as const, map, metadata, orderWeight, qolipInRework: saved.qolip_in_rework === true,
          customer: Object.hasOwn(customers, ticket.id) ? customers[ticket.id] : map.customer_name };
      }
    }
    throw new MobileApiException({ code: 'order_page_changed', message: 'Buyurtma yangilandi. Qayta oching.' });
  };
}
