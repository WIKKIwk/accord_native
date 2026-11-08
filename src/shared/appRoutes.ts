import type { Href } from 'expo-router';
import type { Session } from '../auth';

// Routes and capability sets below are copied from the V2 baseline.
export const appRoutes = {
  "login": "/",
  "supplierHome": "/supplier-home",
  "supplierStatusBreakdown": "/supplier-status-breakdown",
  "supplierSubmittedCategoryDetail": "/supplier-submitted-category-detail",
  "supplierStatusDetail": "/supplier-status-detail",
  "supplierItemPicker": "/supplier-item-picker",
  "supplierQty": "/supplier-qty",
  "supplierConfirm": "/supplier-confirm",
  "supplierSuccess": "/supplier-success",
  "supplierNotifications": "/supplier-notifications",
  "supplierRecent": "/supplier-recent",
  "notificationDetail": "/notification-detail",
  "werkaHome": "/werka-home",
  "werkaCreateHub": "/werka-create-hub",
  "werkaBatchDispatch": "/werka-batch-dispatch",
  "werkaCustomerIssueCustomer": "/werka-customer-issue-customer",
  "werkaUnannouncedSupplier": "/werka-unannounced-supplier",
  "werkaStockEntryQrScan": "/werka-stock-entry-qr-scan",
  "werkaQrPreview": "/werka-qr-preview",
  "werkaPaddonReceive": "/werka-paddon-receive",
  "werkaStockEntryLookup": "/werka-stock-entry-lookup",
  "werkaArchiveBatchQrLookup": "/werka-archive-batch-qr-lookup",
  "werkaNotifications": "/werka-notifications",
  "werkaArchive": "/werka-archive",
  "werkaArchiveSentHub": "/werka-archive-sent-hub",
  "werkaArchiveDailyCalendar": "/werka-archive-daily-calendar",
  "werkaArchiveMonthlyCalendar": "/werka-archive-monthly-calendar",
  "werkaArchiveYearlyCalendar": "/werka-archive-yearly-calendar",
  "werkaArchivePeriods": "/werka-archive-periods",
  "werkaArchiveList": "/werka-archive-list",
  "werkaStatusBreakdown": "/werka-status-breakdown",
  "werkaStatusDetail": "/werka-status-detail",
  "werkaDetail": "/werka-detail",
  "werkaCustomerDeliveryDetail": "/werka-customer-delivery-detail",
  "werkaSuccess": "/werka-success",
  "profile": "/profile",
  "chat": "/chat",
  "chatDirectory": "/chat/directory",
  "chatDetail": "/chat/detail",
  "chatParticipantProfile": "/chat/participant-profile",
  "customerHome": "/customer-home",
  "customerNotifications": "/customer-notifications",
  "customerStatusDetail": "/customer-status-detail",
  "customerDetail": "/customer-detail",
  "pinSetupEntry": "/pin-setup-entry",
  "pinSetupConfirm": "/pin-setup-confirm",
  "adminHome": "/admin-home",
  "salesHome": "/sales-home",
  "brigaderHome": "/brigader-home",
  "adminActivity": "/admin-activity",
  "adminCalculate": "/admin-calculate",
  "adminCalculateMaterials": "/admin-calculate-materials",
  "adminCalculateOrders": "/admin-calculate-orders",
  "adminCreateHub": "/admin-create-hub",
  "adminSettings": "/admin-settings",
  "adminAdditionalSettings": "/admin-additional-settings",
  "adminPushConfig": "/admin-push-config",
  "adminTraining": "/admin-training",
  "adminEmergencyReset": "/admin-emergency-reset",
  "adminTelegram": "/admin-telegram",
  "adminRoles": "/admin-roles",
  "adminNotifications": "/admin-notifications",
  "adminProductionMapTest": "/admin-production-map-test",
  "adminProductionMapOrders": "/admin-production-map-orders",
  "adminOpeningWip": "/admin-opening-wip",
  "supplySequence": "/supply-sequence",
  "materialTasks": "/material-tasks",
  "adminProgressQrScan": "/admin-progress-qr-scan",
  "adminServerMonitor": "/admin-server-monitor",
  "adminFactoryMap": "/admin-factory-map",
  "adminFactoryLocations": "/admin-factory-locations",
  "adminWipBatches": "/admin-wip-batches",
  "adminQueuePolicies": "/admin-queue-policies",
  "adminApparatusSettings": "/admin-apparatus-settings",
  "adminApparatusGroups": "/admin-apparatus-groups",
  "adminRawMaterialSettings": "/admin-raw-material-settings",
  "adminRawMaterialRules": "/admin-raw-material-rules",
  "adminRawMaterialAssignments": "/admin-raw-material-assignments",
  "adminApparatusCreate": "/admin-apparatus-create",
  "apparatusQueue": "/apparatus-queue",
  "apparatusWorkInstructions": "/apparatus-work-instructions",
  "apparatusDailyWork": "/apparatus-daily-work",
  "apparatusPaddons": "/apparatus-paddons",
  "apparatusPaddonDetail": "/apparatus-paddon-detail",
  "adminSuppliers": "/admin-suppliers",
  "adminWorkerSettings": "/admin-worker-settings",
  "adminWarehouses": "/admin-warehouses",
  "adminUserCreate": "/admin-user-create",
  "adminSupplierCreate": "/admin-supplier-create",
  "adminCustomerCreate": "/admin-customer-create",
  "adminCustomerDetail": "/admin-customer-detail",
  "adminWorkerDetail": "/admin-worker-detail",
  "adminWorkerProfileDetail": "/admin-worker-profile-detail",
  "adminInactiveSuppliers": "/admin-inactive-suppliers",
  "adminItemCreate": "/admin-item-create",
  "adminItemDetail": "/admin-item-detail",
  "adminItemGroupCreate": "/admin-item-group-create",
  "adminItemBulkMove": "/admin-item-bulk-move",
  "adminSupplierDetail": "/admin-supplier-detail",
  "adminSupplierItemsView": "/admin-supplier-items-view",
  "adminSupplierItemsAdd": "/admin-supplier-items-add",
  "adminWerka": "/admin-werka",
  "materialHome": "/material-home",
  "materialHistory": "/material-history",
  "inventoryMovements": "/inventory-movements",
  "gscaleMode": "/gscale-mode",
  "qolipHome": "/qolip",
  "qolipBlocks": "/qolip-blocks",
  "qolipProducts": "/qolip-products",
  "qolipSets": "/qolip-sets",
  "qolipReworks": "/qolip-reworks",
  "qolipPaddons": "/qolip-paddons",
  "qolipArchive": "/qolip-archive",
  "qolipTasks": "/qolip-tasks",
  "qolipCheckouts": "/qolip-checkouts",
  "qolipLocationTransfer": "/qolip-location-transfer",
  "qolipProductTransfer": "/qolip-product-transfer",
  /** @v2 AppRoutes.boyoqchiHome */
  "boyoqchiHome": "/boyoqchi-home",
  "preparation": "/preparation",
  "preparationFormulas": "/preparation-formulas",
  "preparationProduction": "/preparation-production",
  "rawMaterialSplit": "/raw-material-split",
  "rawMaterialSplitHistory": "/raw-material-split-history",
  /** @v2 AppRoutes.boyoqchiAstatka */
  "boyoqchiAstatka": "/boyoqchi-astatka",
  "rezkaSplit": "/rezka-split"
} as const;

const routeCapabilities: Record<string, readonly string[]> = {
  "/supplier-home": [
    "supplier.access"
  ],
  "/supplier-status-breakdown": [
    "supplier.access"
  ],
  "/supplier-submitted-category-detail": [
    "supplier.access"
  ],
  "/supplier-status-detail": [
    "supplier.access"
  ],
  "/supplier-item-picker": [
    "supplier.access"
  ],
  "/supplier-qty": [
    "supplier.access"
  ],
  "/supplier-confirm": [
    "supplier.access"
  ],
  "/supplier-success": [
    "supplier.access"
  ],
  "/supplier-notifications": [
    "supplier.access"
  ],
  "/supplier-recent": [
    "supplier.access"
  ],
  "/customer-home": [
    "customer.access"
  ],
  "/customer-notifications": [
    "customer.access"
  ],
  "/customer-status-detail": [
    "customer.access"
  ],
  "/customer-detail": [
    "customer.access"
  ],
  "/notification-detail": [
    "supplier.access",
    "werka.access",
    "customer.access"
  ],
  "/werka-home": [
    "werka.access"
  ],
  "/werka-create-hub": [
    "werka.access"
  ],
  "/werka-batch-dispatch": [
    "werka.access"
  ],
  "/werka-customer-issue-customer": [
    "werka.access"
  ],
  "/werka-unannounced-supplier": [
    "werka.access"
  ],
  "/werka-stock-entry-qr-scan": [
    "werka.access"
  ],
  "/werka-qr-preview": [
    "werka.access"
  ],
  "/werka-paddon-receive": [
    "werka.access"
  ],
  "/werka-stock-entry-lookup": [
    "werka.access"
  ],
  "/werka-archive-batch-qr-lookup": [
    "werka.access"
  ],
  "/werka-notifications": [
    "werka.access"
  ],
  "/werka-archive": [
    "werka.access"
  ],
  "/werka-archive-sent-hub": [
    "werka.access"
  ],
  "/werka-archive-daily-calendar": [
    "werka.access"
  ],
  "/werka-archive-monthly-calendar": [
    "werka.access"
  ],
  "/werka-archive-yearly-calendar": [
    "werka.access"
  ],
  "/werka-archive-periods": [
    "werka.access"
  ],
  "/werka-archive-list": [
    "werka.access"
  ],
  "/werka-status-breakdown": [
    "werka.access"
  ],
  "/werka-status-detail": [
    "werka.access"
  ],
  "/werka-detail": [
    "werka.access"
  ],
  "/werka-customer-delivery-detail": [
    "werka.access"
  ],
  "/werka-success": [
    "werka.access"
  ],
  "/gscale-mode": [
    "gscale.catalog.read",
    "gscale.print",
    "rps.batch.manage"
  ],
  "/material-home": [
    "gscale.catalog.read",
    "gscale.print",
    "rps.batch.manage",
    "catalog.item.create",
    "raw_material.assign"
  ],
  "/material-history": [
    "gscale.catalog.read",
    "gscale.print",
    "rps.batch.manage",
    "catalog.item.create",
    "raw_material.assign"
  ],
  "/inventory-movements": [
    "inventory.movement.manage"
  ],
  "/qolip": [
    "qolip.manage"
  ],
  "/qolip-blocks": [
    "qolip.manage"
  ],
  "/qolip-products": [
    "qolip.manage"
  ],
  "/qolip-sets": [
    "qolip.manage"
  ],
  "/qolip-reworks": [
    "qolip.manage"
  ],
  "/qolip-paddons": [
    "qolip.manage"
  ],
  "/qolip-archive": [
    "qolip.manage"
  ],
  "/qolip-tasks": [
    "qolip.manage"
  ],
  "/material-tasks": [
    "raw_material.assign"
  ],
  "/qolip-checkouts": [
    "qolip.manage"
  ],
  "/qolip-location-transfer": [
    "qolip.manage"
  ],
  "/qolip-product-transfer": [
    "qolip.manage"
  ],
  "/boyoqchi-home": [
    "boyoqchi.access"
  ],
  "/preparation": [
    "preparation.access"
  ],
  "/preparation-formulas": [
    "preparation.access"
  ],
  "/preparation-production": [
    "preparation.access"
  ],
  "/raw-material-split": [
    "raw_material.split"
  ],
  "/raw-material-split-history": [
    "raw_material.split"
  ],
  "/boyoqchi-astatka": [
    "boyoqchi.access"
  ],
  "/rezka-split": [
    "rezka.split.manage"
  ],
  "/admin-home": [
    "admin.access",
    "role.capability.read",
    "role.capability.manage",
    "admin.settings.read",
    "admin.settings.manage",
    "catalog.item.read",
    "catalog.item.create",
    "catalog.item_group.read",
    "catalog.item_group.manage",
    "catalog.item.bulk_move",
    "party.supplier.read",
    "party.supplier.manage",
    "party.supplier.item.assign",
    "party.supplier.code.manage",
    "party.customer.read",
    "party.customer.manage",
    "party.customer.item.assign",
    "party.customer.code.manage",
    "admin.activity.read",
    "werka.code.manage",
    "production.map.manage",
    "factory.location.manage",
    "inventory.movement.manage",
    "raw_material.rule.manage",
    "raw_material.assign",
    "rezka.split.manage"
  ],
  "/admin-activity": [
    "admin.activity.read"
  ],
  "/sales-home": [
    "sales.access"
  ],
  "/brigader-home": [
    "brigader.access"
  ],
  "/admin-calculate": [
    "admin.access",
    "production.map.manage",
    "production.order.create",
    "production.order.edit"
  ],
  "/admin-calculate-materials": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-calculate-orders": [
    "admin.access",
    "production.map.manage",
    "production.order.create"
  ],
  "/admin-create-hub": [
    "admin.access",
    "catalog.item.create",
    "catalog.item_group.manage",
    "party.supplier.manage",
    "party.customer.manage",
    "werka.code.manage",
    "role.capability.manage"
  ],
  "/admin-settings": [
    "admin.settings.read"
  ],
  "/admin-additional-settings": [
    "admin.access"
  ],
  "/admin-push-config": [
    "admin.settings.read"
  ],
  "/admin-training": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-emergency-reset": [
    "admin.access"
  ],
  "/admin-telegram": [
    "admin.settings.read"
  ],
  "/admin-roles": [
    "role.capability.read"
  ],
  "/admin-notifications": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-production-map-test": [
    "admin.access",
    "production.map.manage",
    "production.map.edit"
  ],
  "/admin-production-map-orders": [
    "admin.access",
    "production.map.manage",
    "production.map.read"
  ],
  "/admin-opening-wip": [
    "admin.access",
    "production.map.manage"
  ],
  "/supply-sequence": [
    "qolip.manage",
    "raw_material.assign",
    "preparation.access"
  ],
  "/admin-progress-qr-scan": [
    "admin.access",
    "production.map.manage",
    "apparatus.queue.read",
    "apparatus.queue.manage"
  ],
  "/admin-server-monitor": [
    "admin.access"
  ],
  "/admin-factory-map": [
    "admin.access"
  ],
  "/admin-factory-locations": [
    "factory.location.manage"
  ],
  "/admin-wip-batches": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-queue-policies": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-apparatus-settings": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-apparatus-groups": [
    "admin.access",
    "production.map.manage"
  ],
  "/admin-raw-material-settings": [
    "raw_material.rule.manage",
    "raw_material.assign"
  ],
  "/admin-raw-material-rules": [
    "raw_material.rule.manage"
  ],
  "/admin-raw-material-assignments": [
    "raw_material.assign"
  ],
  "/admin-apparatus-create": [
    "admin.access",
    "production.map.manage"
  ],
  "/apparatus-queue": [
    "apparatus.queue.read",
    "apparatus.queue.manage"
  ],
  "/apparatus-work-instructions": [
    "apparatus.queue.read",
    "apparatus.queue.manage"
  ],
  "/apparatus-daily-work": [
    "apparatus.queue.read",
    "apparatus.queue.manage"
  ],
  "/apparatus-paddons": [
    "apparatus.queue.read",
    "apparatus.queue.manage"
  ],
  "/apparatus-paddon-detail": [
    "apparatus.queue.read",
    "apparatus.queue.manage"
  ],
  "/admin-suppliers": [
    "party.supplier.read",
    "party.customer.read"
  ],
  "/admin-worker-settings": [
    "admin.access"
  ],
  "/admin-warehouses": [
    "catalog.item.read",
    "catalog.item_group.read",
    "raw_material.assign"
  ],
  "/admin-user-create": [
    "party.supplier.manage",
    "party.customer.manage",
    "werka.code.manage"
  ],
  "/admin-supplier-create": [
    "party.supplier.manage"
  ],
  "/admin-customer-create": [
    "party.customer.manage"
  ],
  "/admin-customer-detail": [
    "party.customer.read"
  ],
  "/admin-worker-detail": [
    "admin.access"
  ],
  "/admin-worker-profile-detail": [
    "admin.access"
  ],
  "/admin-inactive-suppliers": [
    "party.supplier.read"
  ],
  "/admin-item-create": [
    "catalog.item.read",
    "catalog.item.create",
    "catalog.item.bulk_move"
  ],
  "/admin-item-detail": [
    "admin.access"
  ],
  "/admin-item-group-create": [
    "catalog.item_group.manage"
  ],
  "/admin-item-bulk-move": [
    "catalog.item.bulk_move"
  ],
  "/admin-supplier-detail": [
    "party.supplier.read"
  ],
  "/admin-supplier-items-view": [
    "party.supplier.item.assign"
  ],
  "/admin-supplier-items-add": [
    "party.supplier.item.assign"
  ],
  "/admin-werka": [
    "werka.code.manage"
  ]
};
const rezkaRoutes = new Set<string>([
  "/apparatus-queue",
  "/apparatus-daily-work",
  "/apparatus-work-instructions",
  "/apparatus-paddons",
  "/apparatus-paddon-detail",
  "/admin-worker-settings",
  "/admin-additional-settings"
]);
const brigaderRoutes = new Set<string>([
  "/brigader-home",
  "/admin-home",
  "/admin-factory-map",
  "/admin-calculate-orders",
  "/admin-calculate",
  "/admin-production-map-test",
  "/admin-production-map-orders",
  "/admin-suppliers",
  "/admin-activity",
  "/admin-item-bulk-move",
  "/admin-opening-wip",
  "/admin-wip-batches",
  "/admin-notifications",
  "/admin-apparatus-settings",
  "/admin-apparatus-groups",
  "/admin-additional-settings",
  "/admin-warehouses",
  "/admin-factory-locations",
  "/admin-raw-material-settings",
  "/admin-raw-material-rules",
  "/admin-raw-material-assignments",
  "/admin-calculate-materials",
  "/admin-worker-settings",
  "/admin-item-group-create",
  "/admin-create-hub",
  "/admin-user-create",
  "/admin-supplier-create",
  "/admin-customer-create",
  "/admin-customer-detail",
  "/admin-worker-detail",
  "/admin-worker-profile-detail",
  "/admin-inactive-suppliers",
  "/admin-item-create",
  "/admin-item-detail",
  "/admin-supplier-detail",
  "/admin-supplier-items-view",
  "/admin-supplier-items-add",
  "/admin-werka",
  "/admin-queue-policies",
  "/admin-apparatus-create",
  "/admin-progress-qr-scan",
  "/apparatus-queue",
  "/apparatus-work-instructions",
  "/apparatus-daily-work",
  "/apparatus-paddons",
  "/apparatus-paddon-detail",
  "/inventory-movements"
]);
const salesRoutes = new Set<string>([
  "/sales-home",
  "/admin-create-hub",
  "/admin-calculate",
  "/admin-calculate-orders",
  "/admin-production-map-test",
  "/admin-production-map-orders",
  "/admin-user-create",
  "/admin-customer-create",
  "/admin-suppliers",
  "/admin-customer-detail",
  "/admin-item-create"
]);

const materialCapabilities = [
  'gscale.catalog.read', 'gscale.print', 'rps.batch.manage', 'catalog.item.create',
  'raw_material.assign', 'inventory.movement.manage',
];
const adminHomeCapabilities = [
  'admin.access', 'role.capability.read', 'role.capability.manage', 'admin.settings.read',
  'admin.settings.manage', 'catalog.item.read', 'catalog.item.create', 'catalog.item_group.read',
  'catalog.item_group.manage', 'catalog.item.bulk_move', 'party.supplier.read',
  'party.supplier.manage', 'party.supplier.item.assign', 'party.supplier.code.manage',
  'party.customer.read', 'party.customer.manage', 'party.customer.item.assign',
  'party.customer.code.manage', 'admin.activity.read', 'werka.code.manage', 'production.map.manage',
  'factory.location.manage', 'inventory.movement.manage', 'raw_material.rule.manage', 'raw_material.assign',
];

function loggedIn(session: Session | null): session is Session {
  return !!session && !!session.token.trim() && typeof session.profile.ref === 'string' && !!session.profile.ref.trim();
}

/** @v2 AppSession.homeRoute */
export function homeRoute(session: Session | null): string {
  if (!loggedIn(session)) return appRoutes.login;
  const role = session.profile.role;
  const has = (code: string) => session.capabilities.includes(code);
  const any = (codes: readonly string[]) => codes.some(has);
  if (role === 'rezka_master' && has('rezka.master.access')) return appRoutes.apparatusQueue;
  if (role === 'brigader' && has('brigader.access')) return appRoutes.brigaderHome;
  if (role === 'sales_manager' && has('sales.access')) return appRoutes.salesHome;
  if (role === 'homashyo_rezkachi' && has('raw_material.split')) return appRoutes.rawMaterialSplit;
  if (role === 'tayyorlov_masteri' && has('preparation.access')) return appRoutes.preparation;
  if (role === 'qolipchi' && has('qolip.manage')) return appRoutes.qolipHome;
  if (has('admin.access')) return appRoutes.adminHome;
  if (has('werka.access')) return appRoutes.werkaHome;
  if (has('supplier.access')) return appRoutes.supplierHome;
  if (has('customer.access')) return appRoutes.customerHome;
  if (has('boyoqchi.access')) return appRoutes.boyoqchiHome;
  if (role === 'material_taminotchi' && any(materialCapabilities)) return appRoutes.materialHome;
  if (any(adminHomeCapabilities)) return appRoutes.adminHome;
  if (has('apparatus.queue.read')) return appRoutes.apparatusQueue;
  if (has('rezka.split.manage')) return appRoutes.rezkaSplit;
  if (has('qolip.manage')) return appRoutes.qolipHome;
  if (any(['gscale.print', 'gscale.catalog.read', 'rps.batch.manage'])) return appRoutes.gscaleMode;
  return appRoutes.login;
}

/** @v2 AppRouter.canOpenRoute */
export function canOpenRoute(session: Session | null, routeName: string | null): boolean {
  if (routeName && (routeName.startsWith('/') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(routeName))) {
    try {
      const path = decodeURIComponent(new URL(routeName, 'https://route.invalid').pathname);
      if (path === appRoutes.apparatusPaddons) routeName = appRoutes.apparatusPaddons;
    } catch { /* An invalid URI is not the paddon route. */ }
  }
  if (routeName === null || [appRoutes.login, appRoutes.profile, appRoutes.chat, appRoutes.chatDirectory,
    appRoutes.chatDetail, appRoutes.chatParticipantProfile, appRoutes.pinSetupEntry, appRoutes.pinSetupConfirm].some(route => route === routeName)) return true;
  if (!loggedIn(session)) return false;
  const role = session.profile.role;
  const has = (code: string) => session.capabilities.includes(code);
  if (routeName === appRoutes.inventoryMovements && role === 'tayyorlov_masteri') return has('preparation.access');
  if (role === 'rezka_master') return has('rezka.master.access') && rezkaRoutes.has(routeName);
  if (role === 'brigader') return has('brigader.access') && brigaderRoutes.has(routeName);
  if (routeName === appRoutes.preparationProduction && role !== 'tayyorlov_masteri') return false;
  if (role === 'sales_manager' && !salesRoutes.has(routeName)) return false;
  if (routeName === appRoutes.qolipProductTransfer && role !== 'qolipchi') return false;
  if ((routeName === appRoutes.adminPushConfig || routeName === appRoutes.adminAdditionalSettings) && role !== 'admin') return false;
  if ((routeName === appRoutes.rawMaterialSplit || routeName === appRoutes.rawMaterialSplitHistory) && role !== 'homashyo_rezkachi') return false;
  return (routeCapabilities[routeName] ?? []).some(has);
}

// Add a single row when both platform screens for a V2 home become available.
const homeTargets: Record<string, { ios?: Href; android?: Href | 'worker' }> = {
  [appRoutes.apparatusQueue]: { ios: '/ios-worker', android: 'worker' },
  [appRoutes.preparation]: { ios: '/ios-preparation' as Href, android: '/android-preparation' as Href },
  [appRoutes.boyoqchiHome]: { ios: '/ios-boyoqchi' as Href, android: '/android-boyoqchi' as Href },
  [appRoutes.materialHome]: { ios: '/ios-material' as Href, android: '/android-material' as Href },
  [appRoutes.rawMaterialSplit]: { ios: '/ios-homashyo' as Href, android: '/android-homashyo' as Href },
  [appRoutes.rezkaSplit]: { ios: '/rezka-split' as Href, android: '/rezka-split' as Href },
};

export function homeTarget(session: Session, platform: string): Href | 'worker' | null {
  const route = homeRoute(session);
  if (session.profile.role === 'rezka_master') {
    if (route !== appRoutes.apparatusQueue || !canOpenRoute(session, appRoutes.apparatusQueue)) return null;
    return platform === 'ios' ? '/ios-rezka' as Href : platform === 'android' ? '/android-rezka' as Href : null;
  }
  if ((route === appRoutes.boyoqchiHome || route === appRoutes.rezkaSplit) && !canOpenRoute(session, route)) return null;
  const entry = homeTargets[route];
  return platform === 'ios' ? entry?.ios ?? null : platform === 'android' ? entry?.android ?? null : null;
}
