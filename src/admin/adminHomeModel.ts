import type { Session } from '../auth';
import { appRoutes, canOpenRoute } from '../shared/appRoutes';
import { adminText, localizedGetter, productionText } from '../shared/localization';
import type { AdminStoreSnapshot } from './adminStore';

export type AdminHomeAction = { title: string; routeName: string; materialIcon: string };
const hiddenSalesRoutes = new Set<string>([appRoutes.adminItemCreate, appRoutes.adminUserCreate,
  appRoutes.adminSuppliers, appRoutes.adminProductionMapTest]);

/** @v2 _AdminHomeScreenState._canLoadSummary */
export function adminHomeCanLoadSummary(session: Session | null): boolean {
  return session?.capabilities.includes('party.supplier.read') ?? false;
}
/** @v2 _adminHomeActions */
export function adminHomeActions(session: Session, locale: string): AdminHomeAction[] {
  const get = (key: string) => localizedGetter(key, locale);
  const candidates: AdminHomeAction[] = [
    { title: get('adminCreateItemTitle'), materialIcon: 'inventory_2_outlined', routeName: appRoutes.adminItemCreate },
    { title: get('adminProductsTitle'), materialIcon: 'grid_view_rounded', routeName: appRoutes.adminItemBulkMove },
    { title: get('adminWarehousesNavTitle'), materialIcon: 'warehouse_rounded', routeName: appRoutes.adminWarehouses },
    { title: get('adminFactoryStatesNavTitle'), materialIcon: 'add_location_alt_outlined', routeName: appRoutes.adminFactoryLocations },
    { title: adminText('home.inventory_transfer', locale), materialIcon: 'swap_horiz_rounded', routeName: appRoutes.inventoryMovements },
    { title: get('adminCreateItemGroupTitle'), materialIcon: 'account_tree_outlined', routeName: appRoutes.adminItemGroupCreate },
    { title: get('adminCreateUserTitle'), materialIcon: 'group_add_outlined', routeName: appRoutes.adminUserCreate },
    { title: get('adminUsersTitle'), materialIcon: 'groups_outlined', routeName: appRoutes.adminSuppliers },
    { title: get('adminRolesTitle'), materialIcon: 'admin_panel_settings_outlined', routeName: appRoutes.adminRoles },
    { title: get('adminTelegramTitle'), materialIcon: 'telegram', routeName: appRoutes.adminTelegram },
    { title: get('adminQuickOrdersTitle'), materialIcon: 'list_alt_rounded', routeName: appRoutes.adminCalculateOrders },
    { title: adminText('home.raw_material_microns', locale), materialIcon: 'straighten_rounded', routeName: appRoutes.adminCalculateMaterials },
    { title: get('adminProductionMapTestTitle'), materialIcon: 'schema_rounded', routeName: appRoutes.adminProductionMapTest },
    { title: get('adminEquipmentNavTitle'), materialIcon: 'precision_manufacturing_rounded', routeName: appRoutes.adminApparatusSettings },
    { title: get('adminRawMaterialRulesNavTitle'), materialIcon: 'rule_rounded', routeName: appRoutes.adminRawMaterialSettings },
    { title: get('adminWorkMapNavTitle'), materialIcon: 'account_tree_outlined', routeName: appRoutes.adminProductionMapOrders },
    { title: get('adminSemiFinishedProductsNavTitle'), materialIcon: 'inventory_2_outlined', routeName: appRoutes.adminWipBatches },
    { title: adminText('home.gscale', locale), materialIcon: 'scale_outlined', routeName: appRoutes.gscaleMode },
    { title: get('adminErpSettingsTitle'), materialIcon: 'settings_outlined', routeName: appRoutes.adminSettings },
    { title: productionText('paddon.management.settings.title', locale), materialIcon: 'tune_rounded', routeName: appRoutes.adminAdditionalSettings },
    { title: adminText('emergency_reset.title', locale), materialIcon: 'delete_sweep_outlined', routeName: appRoutes.adminEmergencyReset },
    { title: get('adminActivityTitle'), materialIcon: 'history_outlined', routeName: appRoutes.adminActivity },
    { title: get('adminServerStatusNavTitle'), materialIcon: 'monitor_heart_outlined', routeName: appRoutes.adminServerMonitor },
  ];
  const sales = session.profile.role === 'sales_manager';
  return candidates.filter(action => canOpenRoute(session, action.routeName) && (!sales || !hiddenSalesRoutes.has(action.routeName)));
}
/** @v2 _AdminHomeShortcutList */
export function adminHomeShortcuts(session: Session, locale: string): Omit<AdminHomeAction, 'materialIcon'>[] {
  return [
    { title: localizedGetter('adminFactoryMapNavTitle', locale), routeName: appRoutes.adminFactoryMap },
    { title: localizedGetter('adminQuickOrdersTitle', locale), routeName: appRoutes.adminCalculateOrders },
    { title: localizedGetter('adminOpenOrderTitle', locale), routeName: appRoutes.adminCalculate },
    { title: localizedGetter('adminWorkMapNavTitle', locale), routeName: appRoutes.adminProductionMapOrders },
  ].filter(action => canOpenRoute(session, action.routeName));
}
export function adminHomeTitle(session: Session, locale: string): string {
  return session.profile.role === 'brigader' ? 'Brigader' : session.profile.role === 'sales_manager'
    ? 'Sotuv manageri' : localizedGetter('adminRoleName', locale);
}
export function adminHomeViewState(session: Session, store: AdminStoreSnapshot): 'loading' | 'error' | 'shortcuts' | 'actions' {
  if (!adminHomeCanLoadSummary(session)) return 'actions';
  if (store.loadingSummary && !store.loadedSummary) return 'loading';
  if (store.summaryError != null && !store.loadedSummary) return 'error';
  return 'shortcuts';
}
export const adminHomeShowsActionIcons = (session: Session): boolean => session.profile.role !== 'sales_manager';
