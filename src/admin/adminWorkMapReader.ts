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
import { dartTrim } from './dartJsonString';
import { adminClosedOrderDetail } from './adminClosedOrderDetailApi';

/** Capture one witness and one read scope for this screen; never recapture a stale operation. */
function adminWorkMapGuard(session: Session, isWitnessCurrent: () => boolean) {
  const scope = sessionReadScope(session);
  let retired = false;
  const readWitness = () => {
    if (retired) return false;
    try {
      if (!activeSessionToken(session)) { retired = true; return false; }
      const current = isWitnessCurrent();
      // Pass malformed/async values to the outer validator and never revive an observed loss.
      if (current !== true) { retired = true; return current; }
      if (sessionReadScope(session) !== scope || !canOpenRoute(session, appRoutes.adminProductionMapOrders)) { retired = true; return false; }
      return true;
    } catch (error) { retired = true; throw error; }
  };
  const guard = checkedAdminGuard(() => {
    if (!isProfileSessionCurrent(readWitness)) throw new Error('Admin work map session changed');
  })!;
  return { guard, readWitness };
}
export function adminWorkMapReader(session: Session, isWitnessCurrent: () => boolean) {
  const { guard, readWitness } = adminWorkMapGuard(session, isWitnessCurrent);
  return async (request: ProductionOrderPageRequest): Promise<AdminWorkMapPage | null> => {
    guard(); const page = await adminProductionOrderPage(session, request, guard, readWitness); guard();
    return page as AdminWorkMapPage | null;
  };
}

/** V2 bootstraps the ordinary Admin catalog with limit 200 and no transient retry. */
export function adminWorkMapCatalogReader(session: Session, isWitnessCurrent: () => boolean) {
  const { guard, readWitness } = adminWorkMapGuard(session, isWitnessCurrent);
  return async () => { guard(); const rows = await adminApparatus(session, { limit: 200, beforeSend: guard, readWitness }); guard(); return rows; };
}

/** A saved calculation read belongs to the same hydrated detail ticket, not a list summary. */
export function adminWorkMapSummaryReader(session: Session, isWitnessCurrent: () => boolean) {
  const { guard, readWitness } = adminWorkMapGuard(session, isWitnessCurrent);
  return async (id: string) => { guard(); const value = await adminProductionMapOrderSummary(session, id, guard, readWitness); guard(); return value; };
}

/** Closed history remains unconnected until its route and transport boundaries are reviewed. */
export function adminWorkMapClosedDetailReader(session: Session, isWitnessCurrent: () => boolean) {
  const { guard, readWitness } = adminWorkMapGuard(session, isWitnessCurrent);
  return async (id: string) => { guard(); const detail = await adminClosedOrderDetail(session, id, guard, readWitness); guard(); return detail; };
}

/** A list summary never authorizes an editor: hydrate and validate the full response first. */
export function adminWorkMapDetailReader(session: Session, isWitnessCurrent: () => boolean) {
  const { guard, readWitness } = adminWorkMapGuard(session, isWitnessCurrent);
  return async (ticket: AdminWorkMapDetailTicket) => {
    guard();
    if (ticket.kind === 'pending') {
      const detail = await pendingOrderDetail(session, ticket.id, guard, readWitness); guard();
      return { kind: 'pending' as const, template: detail.template, managerName: detail.manager_name };
    }
    // V2 retries a stale detail once, not a failed HTTP request. Every retry
    // still belongs to the original list ticket and session witness.
    for (let attempt = 0; attempt < 2; attempt++) {
      guard();
      const snapshot = await adminProductionOrderDetail(session, { apparatus: ticket.apparatus ?? '', order_id: ticket.id }, guard, readWitness);
      guard();
      if (snapshot.epoch === ticket.epoch && snapshot.revision != null && ticket.revision != null && snapshot.revision >= ticket.revision &&
          snapshot.scope && snapshot.maps.length === 1 && snapshot.maps[0].map.id === ticket.id) {
        const saved = snapshot.maps[0], map = saved.map, customers = snapshot.order_customers ?? {};
        const metadata = adminWorkMapMetadataFromSaved(saved);
        guard();
        // Compact Orders detail computes this fallback from its hydrated templates; Sequence and legacy full pages use different metric flows.
        const orderWeight = ticket.ordersSummary ? adminWorkMapOrderWeight(map, Object.values(snapshot.calculation_templates ?? {})) : null;
        // All-order compact detail has a global control and no apparatus-specific control.
        const controls = snapshot.order_controls ?? {}, id = dartTrim(ticket.id);
        const orderControl = ticket.ordersSummary && Object.hasOwn(controls, id) ? controls[id] : null;
        return { kind: 'order' as const, map, metadata, orderWeight, orderControl, qolipInRework: saved.qolip_in_rework === true,
          customer: Object.hasOwn(customers, ticket.id) ? customers[ticket.id] : map.customer_name };
      }
    }
    throw new MobileApiException({ code: 'order_page_changed', message: 'Buyurtma yangilandi. Qayta oching.' });
  };
}
