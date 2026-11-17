import { router, useNavigationContainerRef, usePathname, type Href } from 'expo-router';
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { appRoutes, homeRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { adminDrawerDestinations } from './adminDrawerModel';
import { AdminDrawerNavigation } from './adminDrawerNavigation';
import { adminHomeSymbol } from './adminHomeSymbols';
import { useAdminShell } from './AdminShellContext';
import { useAdminDrawerPresentation } from './AdminDrawerPresentationContext';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
/** Existing drawer, limited to real and reviewed destinations. */
export function AdminDrawer({ children }: { children: ReactNode }) {
  const { session, onLogout, isCurrent, destination } = useAdminShell(), state = useRoleDrawerState(), pathname = usePathname();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), home = homeRoute(session);
  const navigation = useNavigationContainerRef();
  const presentation = useAdminDrawerPresentation();
  const workspace = session.profile.role === 'brigader' ? 'brigader' : 'admin';
  const owner = useMemo(() => new AdminDrawerNavigation({ platform: Platform.OS, workspace, home, isCurrent,
    destination: route => destination(route, Platform.OS), rootState: () => navigation.getRootState(),
    push: path => router.push(path as Href), replace: path => router.replace(path as Href), popTo: path => router.dismissTo(path as Href),
    confirmLogout: confirmRoleDrawerLogout, logout: onLogout,
  }), [home, workspace, isCurrent, destination, navigation, onLogout]);
  useEffect(() => { owner.attach(); return () => owner.detach(); }, [owner]);
  const destinations = presentation?.destinations ?? adminDrawerDestinations(session, locale).filter(item => item.routeName === home || !!destination(item.routeName, Platform.OS));
  const items = presentation?.items ?? destinations
    .map(item => ({ id: item.routeName, label: item.label, symbol: item.routeName === home ? { ios: 'house' as const, android: 'home' as const }
      : item.routeName === appRoutes.profile ? { ios: 'person' as const, android: 'person' as const }
      : item.routeName === appRoutes.adminSuppliers ? { ios: 'person.3' as const, android: 'groups' as const }
      : item.routeName === appRoutes.adminWarehouses ? { ios: 'building.2' as const, android: 'warehouse' as const }
        : item.routeName === appRoutes.adminProductionMapOrders || item.routeName === appRoutes.adminFactoryLocations ||
          item.routeName === appRoutes.adminItemGroupCreate || item.routeName === appRoutes.adminRoles ? adminHomeSymbol(item.materialIcon)
        : item.routeName === appRoutes.adminAdditionalSettings ? adminHomeSymbol('tune_rounded')
        : { ios: 'scalemass' as const, android: 'scale' as const } }));
  const select = (id: string) => {
    if (id === 'logout') { owner.logout(); return; }
    const entry = destinations.find(item => item.routeName === id); if (entry) owner.select(entry);
  };
  const active = pathname.endsWith('/profile') ? appRoutes.profile : pathname.endsWith('/work-map') ? appRoutes.adminProductionMapOrders
    : pathname.endsWith('/users') || pathname.includes('/owned/') ? appRoutes.adminSuppliers
    : pathname.endsWith('/warehouses') ? appRoutes.adminWarehouses
    : pathname.endsWith('/factory-locations') ? appRoutes.adminFactoryLocations : pathname.endsWith('/activity') ? appRoutes.adminActivity
    : pathname.endsWith('/additional-settings') ? appRoutes.adminAdditionalSettings : pathname.endsWith('/item-groups') ? appRoutes.adminItemGroupCreate
    : pathname.endsWith('/roles') ? appRoutes.adminRoles : pathname.endsWith('/queue-policies') ? appRoutes.adminApparatusSettings
    : pathname.endsWith('/settings') ? appRoutes.adminSettings : home;
  return <RoleDrawer {...state} title={presentation?.title ?? localizedGetter('adminDrawerSections', locale)} items={items} active={presentation?.active ?? active} onSelect={select} width={presentation?.width}
    closeAccessibilityLabel={localizedGetter('closeAction', locale)}
    footerAction={{ id: 'logout', label: localizedGetter('logoutTitle', locale), destructive: true }}>
    {children}
  </RoleDrawer>;
}
