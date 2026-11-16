import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { appRoutes, homeRoute } from '../shared/appRoutes';
import { localizedGetter } from '../shared/localization';
import { localeController } from '../shared/localization/runtime';
import { RoleDrawer } from '../shared/navigation/RoleDrawer';
import { useRoleDrawerState } from '../shared/navigation/roleDrawerContext';
import { confirmRoleDrawerLogout } from '../shared/navigation/roleDrawerLogout';
import { adminDrawerDestinations } from './adminDrawerModel';
import { adminHomeSymbol } from './adminHomeSymbols';
import { useAdminShell } from './AdminShellContext';

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;
/** Existing drawer, limited to real and reviewed destinations. */
export function AdminDrawer({ children }: { children: ReactNode }) {
  const { session, onLogout, isCurrent, destination } = useAdminShell(), state = useRoleDrawerState(), pathname = usePathname();
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale), home = homeRoute(session);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const scheduled = timers.current;
    return () => { mounted.current = false; for (const timer of scheduled) clearTimeout(timer); };
  }, []);
  const items = adminDrawerDestinations(session, locale).filter(item => item.routeName === home || !!destination(item.routeName, Platform.OS))
    .map(item => ({ id: item.routeName, label: item.label, symbol: item.routeName === home ? { ios: 'house' as const, android: 'home' as const }
      : item.routeName === appRoutes.profile ? { ios: 'person' as const, android: 'person' as const }
        : item.routeName === appRoutes.adminProductionMapOrders || item.routeName === appRoutes.adminFactoryLocations ? adminHomeSymbol(item.materialIcon)
        : { ios: 'scalemass' as const, android: 'scale' as const } }));
  const select = (id: string) => {
    if (!mounted.current || !isCurrent()) return;
    if (id === 'logout') {
      timers.current.push(setTimeout(() => { if (mounted.current && isCurrent()) confirmRoleDrawerLogout(() => { if (mounted.current && isCurrent()) onLogout(); }); }, 120));
      return;
    }
    const path = destination(id, Platform.OS);
    if (!path) return;
    if (id === home && pathname.replace(/\/+$/, '') === path) return;
    timers.current.push(setTimeout(() => {
      if (!mounted.current || !isCurrent() || destination(id, Platform.OS) !== path) return;
      if (id === home) router.dismissTo(path as Href); else router.push(path as Href);
    }, 220));
  };
  const active = pathname.endsWith('/profile') ? appRoutes.profile : pathname.endsWith('/work-map') ? appRoutes.adminProductionMapOrders
    : pathname.endsWith('/factory-locations') ? appRoutes.adminFactoryLocations : pathname.endsWith('/activity') ? appRoutes.adminActivity : home;
  return <RoleDrawer {...state} title={localizedGetter('adminDrawerSections', locale)} items={items} active={active} onSelect={select}
    closeAccessibilityLabel={localizedGetter('closeAction', locale)}
    footerAction={{ id: 'logout', label: localizedGetter('logoutTitle', locale), destructive: true }}>
    {children}
  </RoleDrawer>;
}
