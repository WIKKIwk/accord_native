import type { Session } from '../auth';
import { appRoutes, canOpenRoute, homeRoute } from '../shared/appRoutes';

/** Brigader branch of V2 AppSession.homeRoute and AppRouter.canOpenRoute.
 * Retain Brigader identity and its exact source allowlist, including with stale Admin grants.
 */
export function brigaderMayEnter(session: Session | null): session is Session {
  return !!session && session.token !== 'test-mode-token' && session.profile.role === 'brigader' &&
    homeRoute(session) === appRoutes.brigaderHome && canOpenRoute(session, appRoutes.brigaderHome);
}

// Only actual composed pages are admitted. The full source route inventory lives in the UI contract.
const destinations: Readonly<Record<string, string>> = Object.freeze({
  [appRoutes.brigaderHome]: '',
  [appRoutes.adminHome]: '',
  [appRoutes.profile]: '/profile',
  [appRoutes.adminNotifications]: '/notifications',
  [appRoutes.adminApparatusSettings]: '/apparatus-settings',
  [appRoutes.adminApparatusGroups]: '/apparatus-groups',
  [appRoutes.adminApparatusCreate]: '/apparatus-create',
  [appRoutes.apparatusQueue]: '/apparatus-queue',
  [appRoutes.apparatusWorkInstructions]: '/instructions',
  [appRoutes.apparatusDailyWork]: '/daily-work',
  [appRoutes.apparatusPaddons]: '/paddons',
  [appRoutes.apparatusPaddonDetail]: '/paddon-detail',
  [appRoutes.adminWipBatches]: '/wip-batches',
  [appRoutes.adminOpeningWip]: '/opening-wip',
  [appRoutes.adminWorkerSettings]: '/worker-settings',
  [appRoutes.adminCalculateMaterials]: '/calculate-materials',
  [appRoutes.adminRawMaterialSettings]: '/raw-material-settings',
  [appRoutes.adminRawMaterialRules]: '/raw-material-rules',
  [appRoutes.adminRawMaterialAssignments]: '/raw-material-assignments',
  [appRoutes.adminActivity]: '/activity',
  [appRoutes.adminSuppliers]: '/users',
  [appRoutes.adminUserCreate]: '/user-create',
  [appRoutes.adminSupplierCreate]: '/supplier-create',
  [appRoutes.adminCustomerCreate]: '/customer-create',
  [appRoutes.adminWarehouses]: '/warehouses',
  [appRoutes.adminItemCreate]: '/items',
  [appRoutes.adminItemBulkMove]: '/products',
  [appRoutes.adminItemDetail]: '/item-detail',
  [appRoutes.adminInactiveSuppliers]: '/inactive-suppliers',
  [appRoutes.adminFactoryLocations]: '/factory-locations',
  [appRoutes.adminItemGroupCreate]: '/item-groups',
  [appRoutes.adminAdditionalSettings]: '/additional-settings',
  [appRoutes.adminQueuePolicies]: '/queue-policies',
  [appRoutes.adminProductionMapOrders]: '/work-map',
  [appRoutes.inventoryMovements]: '/inventory',
});

export function brigaderDestinationPath(session: Session, route: string, platform: string): string | null {
  if (!brigaderMayEnter(session) || !canOpenRoute(session, route) || (platform !== 'ios' && platform !== 'android') ||
      !Object.hasOwn(destinations, route)) return null;
  return `/${platform}-brigader${destinations[route]}`;
}

/** Coverage is reported from actual source authority, independently of readiness. */
export function brigaderRouteCoverage(session: Session) {
  return Object.entries(appRoutes).filter(([, route]) => canOpenRoute(session, route)).map(([name, route]) => ({
    name, route, ios: brigaderDestinationPath(session, route, 'ios'), android: brigaderDestinationPath(session, route, 'android'),
  }));
}
