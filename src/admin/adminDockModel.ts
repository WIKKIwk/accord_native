import type { Session } from '../auth';
import { appRoutes, canOpenRoute, homeRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';

export type AdminDockTab = 'home' | 'user' | 'suppliers' | 'settings' | 'activity';
export type AdminDockDestination = { id: string; tab: AdminDockTab | null; label: string; routeName: string;
  materialIcon: string; selectedMaterialIcon: string; primary: boolean };
/** @v2 _visibleDestinations */
export function adminDockDestinations(session: Session, locale: string, includePrimaryAction = false): AdminDockDestination[] {
  const get = (key: string) => localizedGetter(key, locale);
  const destinations: AdminDockDestination[] = [
    { id: 'admin-home', tab: 'home', label: get('adminHomeNavTitle'), routeName: homeRoute(session),
      materialIcon: 'home_outlined', selectedMaterialIcon: 'home_rounded', primary: false },
    { id: 'admin-user', tab: 'user', label: get('adminUserTitle'), routeName: appRoutes.adminSuppliers,
      materialIcon: 'person_outline_rounded', selectedMaterialIcon: 'person_rounded', primary: false },
    { id: 'admin-create', tab: null, label: get('adminCreateTitle'), routeName: appRoutes.adminCreateHub,
      materialIcon: 'add_rounded', selectedMaterialIcon: 'add_rounded', primary: true },
    { id: 'admin-activity', tab: 'activity', label: get('adminActivityNavTitle'), routeName: appRoutes.adminActivity,
      materialIcon: 'history_outlined', selectedMaterialIcon: 'history_rounded', primary: false },
  ];
  return destinations.filter(destination => (destination.primary && includePrimaryAction) || canOpenRoute(session, destination.routeName));
}
export function adminDockPrimaryVisible(destinations: readonly AdminDockDestination[], showPrimaryFab: boolean,
  profileObscuresFab: boolean, menuOpen: boolean): boolean {
  return !menuOpen && showPrimaryFab && !profileObscuresFab && destinations.some(destination => destination.primary);
}
export function adminDockSelection(destination: AdminDockDestination, activeTab: AdminDockTab | null,
  currentRoute: string | null, home: string): 'none' | 'openCreate' | 'replaceRoot' {
  if (destination.primary) return 'openCreate';
  if (activeTab === destination.tab && !(destination.tab === 'home' && currentRoute !== home)) return 'none';
  return 'replaceRoot';
}
export type AdminCreateAction = { id: string; label: string; routeName: string; materialIcon: string; row: number; staggerOrder: number };
/** @v2 _AdminCreateHubOverlayState._actions */
export function adminDefaultCreateActions(session: Session, locale: string): AdminCreateAction[] {
  const get = (key: string) => localizedGetter(key, locale);
  const candidates = [
    { id: 'admin-hub-user-create', label: get('adminCreateUserTitle'), materialIcon: 'group_add_outlined', routeName: appRoutes.adminUserCreate },
    { id: 'admin-hub-item-create', label: get('adminCreateItemTitle'), materialIcon: 'inventory_2_outlined', routeName: appRoutes.adminItemCreate },
    { id: 'admin-hub-progress-qr-scan', label: get('adminQrScanTitle'), materialIcon: 'qr_code_scanner_rounded', routeName: appRoutes.adminProgressQrScan },
    { id: 'admin-hub-quick-orders', label: get('adminQuickOrdersTitle'), materialIcon: 'list_alt_outlined', routeName: appRoutes.adminCalculateOrders },
    { id: 'admin-hub-calculate-order-create', label: get('adminOpenOrderTitle'), materialIcon: 'add_task_outlined', routeName: appRoutes.adminCalculate },
  ].filter(action => canOpenRoute(session, action.routeName));
  return candidates.map((action, row) => ({ ...action, row, staggerOrder: candidates.length - 1 - row }));
}
