import type { Session } from '../auth';
import { appRoutes, canOpenRoute, homeRoute } from '../shared/appRoutes';
import { adminText, localizedGetter, productionText } from '../shared/localization';

export type AdminDrawerDestination = { label: string; routeName: string; materialIcon: string; selectedMaterialIcon: string; push: boolean };
/** @v2 _visibleAdminDrawerDestinations */
export function adminDrawerDestinations(session: Session, locale: string): AdminDrawerDestination[] {
  const get = (key: string) => localizedGetter(key, locale);
  const row = (label: string, routeName: string, materialIcon: string, selectedMaterialIcon: string, push = false): AdminDrawerDestination =>
    ({ label, routeName, materialIcon, selectedMaterialIcon, push });
  return [
    row(get('adminHomeNavTitle'), homeRoute(session), 'home_outlined', 'home_rounded'),
    row(get('adminUsersTitle'), appRoutes.adminSuppliers, 'people_outline_rounded', 'people_rounded'),
    row(get('adminProductsTitle'), session.profile.role === 'sales_manager' ? appRoutes.adminItemCreate : appRoutes.adminItemBulkMove,
      'grid_view_outlined', 'grid_view_rounded'),
    row(get('adminWorkMapNavTitle'), appRoutes.adminProductionMapOrders, 'account_tree_outlined', 'account_tree_rounded'),
    row(adminText('production.opening_wip.action', locale), appRoutes.adminOpeningWip, 'qr_code_2_outlined', 'qr_code_2_rounded'),
    row(get('adminSemiFinishedProductsNavTitle'), appRoutes.adminWipBatches, 'inventory_2_outlined', 'inventory_2_rounded'),
    row(get('adminNotificationsNavTitle'), appRoutes.adminNotifications, 'notifications_outlined', 'notifications_rounded'),
    row(adminText('push.title', locale), appRoutes.adminPushConfig, 'notifications_active_outlined', 'notifications_active_rounded', true),
    row(get('adminEquipmentNavTitle'), appRoutes.adminApparatusSettings, 'precision_manufacturing_outlined', 'precision_manufacturing_rounded'),
    row(adminText('training.title', locale), appRoutes.adminTraining, 'school_outlined', 'school_rounded'),
    row(productionText('paddon.management.settings.title', locale), appRoutes.adminAdditionalSettings, 'tune_outlined', 'tune_rounded'),
    row(adminText('emergency_reset.title', locale), appRoutes.adminEmergencyReset, 'delete_sweep_outlined', 'delete_sweep_rounded'),
    row(get('adminWarehousesNavTitle'), appRoutes.adminWarehouses, 'warehouse_outlined', 'warehouse_rounded'),
    row(get('adminFactoryStatesNavTitle'), appRoutes.adminFactoryLocations, 'add_location_alt_outlined', 'add_location_alt_rounded'),
    row(get('adminRawMaterialRulesNavTitle'), appRoutes.adminRawMaterialSettings, 'rule_outlined', 'rule_rounded'),
    row(adminText('home.raw_material_microns', locale), appRoutes.adminCalculateMaterials, 'straighten_outlined', 'straighten_rounded'),
    row(get('adminWorkersNavTitle'), appRoutes.adminWorkerSettings, 'groups_outlined', 'groups_rounded'),
    row(get('adminRolesTitle'), appRoutes.adminRoles, 'admin_panel_settings_outlined', 'admin_panel_settings_rounded'),
    row(get('adminTelegramTitle'), appRoutes.adminTelegram, 'telegram_outlined', 'telegram'),
    row(get('adminProductGroupsNavTitle'), appRoutes.adminItemGroupCreate, 'account_tree_outlined', 'account_tree_rounded'),
    row(get('adminServerStatusNavTitle'), appRoutes.adminServerMonitor, 'monitor_heart_outlined', 'monitor_heart_rounded'),
    row(get('profileTitle'), appRoutes.profile, 'person_outline_rounded', 'person_rounded', true),
    row(get('adminScalesModeNavTitle'), appRoutes.gscaleMode, 'swap_horiz_rounded', 'swap_horiz_rounded', true),
    row(get('adminCuttingNavTitle'), appRoutes.rezkaSplit, 'content_cut_rounded', 'content_cut_rounded', true),
  ].filter(destination => canOpenRoute(session, destination.routeName));
}
/** @v2 AdminDrawerNavigation.openRoute */
export function adminDrawerNavigationPlan(currentRoute: string | null, destination: AdminDrawerDestination,
  home: string, stack: readonly string[]): 'none' | 'push' | 'replace' | 'popTo' {
  // The shared drawer already handled the selected destination before calling this planner.
  if (destination.push) return 'push';
  if (currentRoute === destination.routeName) return 'none';
  if (stack.includes(destination.routeName)) return 'popTo';
  if (currentRoute !== home && stack.includes(home)) return 'replace';
  return 'push';
}
